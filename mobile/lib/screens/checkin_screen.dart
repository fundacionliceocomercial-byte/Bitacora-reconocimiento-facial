import 'dart:async';
import 'dart:io';
import 'package:camera/camera.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../services/api_service.dart';
import '../services/live_face_detector.dart';
import '../widgets/scan_overlay.dart';
import 'login_screen.dart';

enum _ScanState { starting, scanning, capturing, cooldown, error }

const _navy = Color(0xFF0B1220);
const _navyLight = Color(0xFF111C33);
const _brand = Color(0xFF0F6E56);

class CheckInScreen extends StatefulWidget {
  const CheckInScreen({super.key});

  @override
  State<CheckInScreen> createState() => _CheckInScreenState();
}

class _CheckInScreenState extends State<CheckInScreen> with WidgetsBindingObserver {
  final _api = ApiService();
  final _faceDetector = LiveFaceDetector();

  CameraController? _controller;
  _ScanState _state = _ScanState.starting;

  bool _isProcessingFrame = false;
  int _consecutiveGoodFrames = 0;
  static const _framesNeededToCapture = 4;
  static const _cooldownDuration = Duration(seconds: 3);

  String? _resultMessage;
  bool _resultSuccess = false;
  int? _lastLogId;
  bool _noteSaved = false;
  Timer? _cooldownTimer;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _initCamera();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _cooldownTimer?.cancel();
    _faceDetector.dispose();
    _controller?.dispose();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    final controller = _controller;
    if (controller == null || !controller.value.isInitialized) return;

    if (state == AppLifecycleState.inactive || state == AppLifecycleState.paused) {
      controller.dispose();
    } else if (state == AppLifecycleState.resumed) {
      _initCamera();
    }
  }

  Future<void> _initCamera() async {
    setState(() => _state = _ScanState.starting);
    try {
      final cameras = await availableCameras();
      final frontCamera = cameras.firstWhere(
        (c) => c.lensDirection == CameraLensDirection.front,
        orElse: () => cameras.first,
      );

      final controller = CameraController(
        frontCamera,
        ResolutionPreset.medium,
        enableAudio: false,
        imageFormatGroup: Platform.isAndroid ? ImageFormatGroup.nv21 : ImageFormatGroup.bgra8888,
      );

      await controller.initialize();
      if (!mounted) return;
      _controller = controller;
      _startScanning();
    } catch (e) {
      setState(() {
        _state = _ScanState.error;
        _resultMessage = 'No se pudo acceder a la cámara: $e';
        _resultSuccess = false;
      });
    }
  }

  void _startScanning() {
    final controller = _controller;
    if (controller == null) return;

    setState(() {
      _state = _ScanState.scanning;
      _resultMessage = null;
      _lastLogId = null;
      _noteSaved = false;
      _consecutiveGoodFrames = 0;
    });

    controller.startImageStream((image) async {
      if (_isProcessingFrame || _state != _ScanState.scanning) return;
      _isProcessingFrame = true;

      try {
        final found = await _faceDetector.hasWellFramedFace(
          image: image,
          camera: controller.description,
          deviceOrientation: controller.value.deviceOrientation,
        );

        if (found) {
          setState(() => _consecutiveGoodFrames++);
          if (_consecutiveGoodFrames >= _framesNeededToCapture) {
            _consecutiveGoodFrames = 0;
            await _captureAndSend();
          }
        } else if (_consecutiveGoodFrames != 0) {
          setState(() => _consecutiveGoodFrames = 0);
        }
      } catch (_) {
        // Ignoramos errores de frames individuales; seguimos escaneando.
      } finally {
        _isProcessingFrame = false;
      }
    });
  }

  Future<void> _captureAndSend() async {
    final controller = _controller;
    if (controller == null || _state != _ScanState.scanning) return;

    setState(() => _state = _ScanState.capturing);

    try {
      await controller.stopImageStream();
      final photo = await controller.takePicture();
      final result = await _api.facialCheckIn(File(photo.path));

      HapticFeedback.mediumImpact();
      setState(() {
        _resultSuccess = true;
        _lastLogId = result.logId;
        final accion = result.logType == 'ENTRADA' ? 'Entrada' : 'Salida';
        _resultMessage = '$accion registrada — ${result.employeeName}';
      });
    } catch (e) {
      HapticFeedback.vibrate();
      setState(() {
        _resultSuccess = false;
        _lastLogId = null;
        _resultMessage = e.toString().replaceFirst('ApiException: ', '');
      });
    }

    _enterCooldown();
  }

  void _enterCooldown() {
    setState(() => _state = _ScanState.cooldown);
    _cooldownTimer?.cancel();
    _cooldownTimer = Timer(_cooldownDuration, () {
      if (!mounted) return;
      _startScanning();
    });
  }

  /// Pausa el regreso automático al escaneo mientras el diálogo de
  /// observación está abierto, para que no se reinicie la cámara
  /// de golpe mientras el empleado está escribiendo.
  void _pauseAutoReset() {
    _cooldownTimer?.cancel();
  }

  void _resumeAutoReset() {
    if (!mounted || _state != _ScanState.cooldown) return;
    _cooldownTimer?.cancel();
    _cooldownTimer = Timer(_cooldownDuration, () {
      if (!mounted) return;
      _startScanning();
    });
  }

  Future<void> _openAddNoteDialog() async {
    final logId = _lastLogId;
    if (logId == null) return;

    _pauseAutoReset();
    final controller = TextEditingController();

    final saved = await showDialog<bool>(
      context: context,
      barrierDismissible: true,
      builder: (context) {
        return AlertDialog(
          backgroundColor: _navyLight,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
          title: const Text('Agregar observación', style: TextStyle(color: Colors.white, fontSize: 16)),
          content: TextField(
            controller: controller,
            autofocus: true,
            maxLength: 255,
            maxLines: 3,
            style: const TextStyle(color: Colors.white),
            decoration: InputDecoration(
              hintText: 'Ej: Llegué tarde por una cita médica',
              hintStyle: const TextStyle(color: Colors.white38),
              counterStyle: const TextStyle(color: Colors.white38),
              enabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(8),
                borderSide: const BorderSide(color: Color(0xFF1E2A44)),
              ),
              focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(8),
                borderSide: const BorderSide(color: _brand),
              ),
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(context).pop(false),
              child: const Text('Cancelar', style: TextStyle(color: Colors.white54)),
            ),
            ElevatedButton(
              style: ElevatedButton.styleFrom(backgroundColor: _brand),
              onPressed: () => Navigator.of(context).pop(true),
              child: const Text('Guardar'),
            ),
          ],
        );
      },
    );

    if (saved == true && controller.text.trim().isNotEmpty) {
      try {
        await _api.addNote(logId, controller.text.trim());
        if (mounted) setState(() => _noteSaved = true);
      } catch (e) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text(e.toString().replaceFirst('ApiException: ', ''))),
          );
        }
      }
    }

    _resumeAutoReset();
  }

  Future<void> _cerrarSesion() async {
    await _api.logout();
    if (!mounted) return;
    Navigator.of(context).pushReplacement(MaterialPageRoute(builder: (_) => const LoginScreen()));
  }

  ScanVisualState get _visualState {
    switch (_state) {
      case _ScanState.starting:
        return ScanVisualState.idle;
      case _ScanState.scanning:
        return ScanVisualState.scanning;
      case _ScanState.capturing:
        return ScanVisualState.capturing;
      case _ScanState.cooldown:
        return _resultSuccess ? ScanVisualState.success : ScanVisualState.error;
      case _ScanState.error:
        return ScanVisualState.error;
    }
  }

  Color get _statusColor {
    switch (_visualState) {
      case ScanVisualState.success:
        return const Color(0xFF16A34A);
      case ScanVisualState.error:
        return const Color(0xFFDC2626);
      case ScanVisualState.capturing:
        return const Color(0xFFD97706);
      case ScanVisualState.scanning:
        return _brand;
      case ScanVisualState.idle:
        return Colors.white38;
    }
  }

  String _statusLabel() {
    switch (_state) {
      case _ScanState.starting:
        return 'INICIANDO CÁMARA';
      case _ScanState.scanning:
        return 'ESCANEANDO';
      case _ScanState.capturing:
        return 'VERIFICANDO';
      case _ScanState.cooldown:
        return _resultSuccess ? 'REGISTRO EXITOSO' : 'NO VERIFICADO';
      case _ScanState.error:
        return 'ERROR';
    }
  }

  @override
  Widget build(BuildContext context) {
    final controller = _controller;
    final showAddNoteButton = _state == _ScanState.cooldown && _resultSuccess && _lastLogId != null;

    return Scaffold(
      backgroundColor: _navy,
      body: SafeArea(
        child: Column(
          children: [
            // Encabezado institucional
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
              decoration: const BoxDecoration(
                border: Border(bottom: BorderSide(color: Color(0xFF1E2A44), width: 1)),
              ),
              child: Row(
                children: [
                  Container(
                    width: 36,
                    height: 36,
                    decoration: BoxDecoration(
                      color: _brand,
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: const Icon(Icons.badge_outlined, color: Colors.white, size: 20),
                  ),
                  const SizedBox(width: 12),
                  const Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'CONTROL DE ACCESO',
                          style: TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.w700, letterSpacing: 1.1),
                        ),
                        Text(
                          'Sistema de bitácora de personal',
                          style: TextStyle(color: Colors.white38, fontSize: 11),
                        ),
                      ],
                    ),
                  ),
                  IconButton(
                    onPressed: _cerrarSesion,
                    icon: const Icon(Icons.logout_outlined, color: Colors.white54, size: 20),
                    tooltip: 'Cerrar sesión',
                  ),
                ],
              ),
            ),

            Expanded(
              child: Center(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    // Tarjeta de la cámara
                    Container(
                      width: 280,
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: _navyLight,
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: const Color(0xFF1E2A44)),
                      ),
                      child: Column(
                        children: [
                          Stack(
                            alignment: Alignment.center,
                            children: [
                              ClipRRect(
                                borderRadius: BorderRadius.circular(10),
                                child: SizedBox(
                                  width: 250,
                                  height: 320,
                                  child: controller != null && controller.value.isInitialized
                                      ? CameraPreview(controller)
                                      : Container(
                                          color: Colors.black,
                                          child: const Center(
                                            child: CircularProgressIndicator(color: Colors.white38, strokeWidth: 2),
                                          ),
                                        ),
                                ),
                              ),
                              ScanOverlay(state: _visualState),
                            ],
                          ),
                          const SizedBox(height: 14),

                          // Etiqueta de estado, tipo badge institucional
                          AnimatedSwitcher(
                            duration: const Duration(milliseconds: 200),
                            child: Container(
                              key: ValueKey(_statusLabel()),
                              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                              decoration: BoxDecoration(
                                color: _statusColor.withOpacity(0.12),
                                borderRadius: BorderRadius.circular(6),
                                border: Border.all(color: _statusColor.withOpacity(0.4)),
                              ),
                              child: Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Container(
                                    width: 6,
                                    height: 6,
                                    decoration: BoxDecoration(color: _statusColor, shape: BoxShape.circle),
                                  ),
                                  const SizedBox(width: 8),
                                  Text(
                                    _statusLabel(),
                                    style: TextStyle(
                                      color: _statusColor,
                                      fontSize: 11,
                                      fontWeight: FontWeight.w700,
                                      letterSpacing: 0.8,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),

                    if (_resultMessage != null) ...[
                      const SizedBox(height: 16),
                      Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 40),
                        child: Text(
                          _resultMessage!,
                          textAlign: TextAlign.center,
                          style: TextStyle(
                            color: _resultSuccess ? Colors.white70 : const Color(0xFFFCA5A5),
                            fontSize: 13,
                          ),
                        ),
                      ),
                    ],

                    if (showAddNoteButton) ...[
                      const SizedBox(height: 12),
                      _noteSaved
                          ? const Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Icon(Icons.check_circle_outline, color: Color(0xFF16A34A), size: 16),
                                SizedBox(width: 6),
                                Text('Observación guardada', style: TextStyle(color: Colors.white54, fontSize: 12)),
                              ],
                            )
                          : OutlinedButton.icon(
                              onPressed: _openAddNoteDialog,
                              style: OutlinedButton.styleFrom(
                                foregroundColor: Colors.white70,
                                side: const BorderSide(color: Color(0xFF1E2A44)),
                                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                              ),
                              icon: const Icon(Icons.edit_note, size: 18),
                              label: const Text('Agregar observación', style: TextStyle(fontSize: 13)),
                            ),
                    ],
                  ],
                ),
              ),
            ),

            // Pie institucional
            Padding(
              padding: const EdgeInsets.only(bottom: 20),
              child: Text(
                'El sistema detecta automáticamente ENTRADA o SALIDA',
                style: TextStyle(color: Colors.white.withOpacity(0.3), fontSize: 11),
              ),
            ),
          ],
        ),
      ),
    );
  }
}