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
  String _logType = 'ENTRADA';

  bool _isProcessingFrame = false;
  int _consecutiveGoodFrames = 0;
  static const _framesNeededToCapture = 4;

  String? _resultMessage;
  bool _resultSuccess = false;
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
      final result = await _api.facialCheckIn(File(photo.path), _logType);

      HapticFeedback.mediumImpact();
      setState(() {
        _resultSuccess = true;
        _resultMessage = '${result.employeeName} — ${result.logType} registrada correctamente.';
      });
    } catch (e) {
      HapticFeedback.vibrate();
      setState(() {
        _resultSuccess = false;
        _resultMessage = e.toString().replaceFirst('ApiException: ', '');
      });
    }

    _enterCooldown();
  }

  void _enterCooldown() {
    setState(() => _state = _ScanState.cooldown);
    _cooldownTimer?.cancel();
    _cooldownTimer = Timer(const Duration(seconds: 3), () {
      if (!mounted) return;
      _startScanning();
    });
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

  Color get _accentColor {
    switch (_visualState) {
      case ScanVisualState.success:
        return const Color(0xFF34D399);
      case ScanVisualState.error:
        return const Color(0xFFF87171);
      case ScanVisualState.capturing:
        return const Color(0xFFFBBF24);
      case ScanVisualState.scanning:
        return const Color(0xFF22D3EE);
      case ScanVisualState.idle:
        return const Color(0xFF818CF8);
    }
  }

  String _statusLabel() {
    switch (_state) {
      case _ScanState.starting:
        return 'Iniciando cámara...';
      case _ScanState.scanning:
        return 'Ubícate frente a la cámara';
      case _ScanState.capturing:
        return 'Verificando rostro...';
      case _ScanState.cooldown:
        return _resultSuccess ? '¡Listo!' : 'No se pudo verificar';
      case _ScanState.error:
        return 'Ocurrió un problema';
    }
  }

  @override
  Widget build(BuildContext context) {
    final controller = _controller;
    final accent = _accentColor;

    return Scaffold(
      body: Stack(
        fit: StackFit.expand,
        children: [
          // Fondo con gradiente vibrante
          const DecoratedBox(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [Color(0xFF1E1B4B), Color(0xFF0F172A), Color(0xFF042F2E)],
                stops: [0.0, 0.55, 1.0],
              ),
            ),
          ),

          // Manchas de color difuminadas, decorativas
          Positioned(
            top: -80,
            left: -60,
            child: _glowBlob(const Color(0xFF6366F1), 220),
          ),
          Positioned(
            bottom: -100,
            right: -80,
            child: _glowBlob(const Color(0xFF0EA5A4), 260),
          ),
          AnimatedPositioned(
            duration: const Duration(milliseconds: 500),
            top: 140,
            right: -40,
            child: _glowBlob(accent, 160, opacity: 0.35),
          ),

          SafeArea(
            child: Column(
              children: [
                Padding(
                  padding: const EdgeInsets.fromLTRB(20, 12, 12, 0),
                  child: Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(8),
                        decoration: BoxDecoration(
                          gradient: const LinearGradient(colors: [Color(0xFF22D3EE), Color(0xFF6366F1)]),
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: const Icon(Icons.face_retouching_natural, color: Colors.white, size: 20),
                      ),
                      const SizedBox(width: 10),
                      const Expanded(
                        child: Text(
                          'Bitácora de Personal',
                          style: TextStyle(color: Colors.white, fontSize: 17, fontWeight: FontWeight.w700),
                        ),
                      ),
                      IconButton(
                        onPressed: _cerrarSesion,
                        icon: const Icon(Icons.logout_rounded, color: Colors.white70),
                        tooltip: 'Cerrar sesión',
                      ),
                    ],
                  ),
                ),

                Expanded(
                  child: Center(
                    child: Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 24),
                      child: AspectRatio(
                        aspectRatio: 3 / 4,
                        child: Stack(
                          alignment: Alignment.center,
                          children: [
                            // Tarjeta con brillo alrededor de la cámara
                            AnimatedContainer(
                              duration: const Duration(milliseconds: 400),
                              decoration: BoxDecoration(
                                borderRadius: BorderRadius.circular(32),
                                boxShadow: [
                                  BoxShadow(color: accent.withOpacity(0.45), blurRadius: 40, spreadRadius: 2),
                                ],
                              ),
                              child: ClipRRect(
                                borderRadius: BorderRadius.circular(32),
                                child: Container(
                                  decoration: BoxDecoration(
                                    gradient: LinearGradient(
                                      begin: Alignment.topLeft,
                                      end: Alignment.bottomRight,
                                      colors: [accent.withOpacity(0.7), Colors.white.withOpacity(0.15)],
                                    ),
                                  ),
                                  padding: const EdgeInsets.all(2.5),
                                  child: ClipRRect(
                                    borderRadius: BorderRadius.circular(30),
                                    child: controller != null && controller.value.isInitialized
                                        ? CameraPreview(controller)
                                        : Container(
                                            color: const Color(0xFF0F172A),
                                            child: const Center(
                                              child: CircularProgressIndicator(color: Colors.white70),
                                            ),
                                          ),
                                  ),
                                ),
                              ),
                            ),

                            // Marco de escaneo animado, centrado sobre la cámara
                            const Positioned.fill(child: SizedBox()),
                            Center(child: ScanOverlay(state: _visualState)),
                          ],
                        ),
                      ),
                    ),
                  ),
                ),

                AnimatedSwitcher(
                  duration: const Duration(milliseconds: 200),
                  child: Container(
                    key: ValueKey(_statusLabel()),
                    margin: const EdgeInsets.only(top: 4),
                    padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 9),
                    decoration: BoxDecoration(
                      gradient: LinearGradient(colors: [accent.withOpacity(0.9), accent.withOpacity(0.6)]),
                      borderRadius: BorderRadius.circular(20),
                      boxShadow: [BoxShadow(color: accent.withOpacity(0.4), blurRadius: 16, spreadRadius: 1)],
                    ),
                    child: Text(
                      _statusLabel(),
                      style: const TextStyle(color: Colors.white, fontSize: 14, fontWeight: FontWeight.w600),
                    ),
                  ),
                ),
                if (_resultMessage != null) ...[
                  const SizedBox(height: 10),
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 32),
                    child: Text(
                      _resultMessage!,
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        color: _resultSuccess ? const Color(0xFF86EFAC) : const Color(0xFFFCA5A5),
                        fontSize: 13,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ),
                ],

                const SizedBox(height: 20),

                // Panel inferior con el selector Entrada/Salida
                Container(
                  margin: const EdgeInsets.fromLTRB(20, 0, 20, 20),
                  padding: const EdgeInsets.all(6),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(20),
                    boxShadow: [
                      BoxShadow(color: Colors.black.withOpacity(0.25), blurRadius: 20, offset: const Offset(0, 8)),
                    ],
                  ),
                  child: Row(
                    children: [
                      _modeButton('Entrada', Icons.login_rounded, 'ENTRADA'),
                      _modeButton('Salida', Icons.logout_rounded, 'SALIDA'),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _glowBlob(Color color, double size, {double opacity = 0.45}) {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        gradient: RadialGradient(
          colors: [color.withOpacity(opacity), color.withOpacity(0)],
        ),
      ),
    );
  }

  Widget _modeButton(String label, IconData icon, String value) {
    final selected = _logType == value;
    return Expanded(
      child: GestureDetector(
        onTap: () => setState(() => _logType = value),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 200),
          padding: const EdgeInsets.symmetric(vertical: 13),
          decoration: BoxDecoration(
            gradient: selected
                ? const LinearGradient(colors: [Color(0xFF22D3EE), Color(0xFF6366F1)])
                : null,
            color: selected ? null : Colors.transparent,
            borderRadius: BorderRadius.circular(15),
            boxShadow: selected
                ? [BoxShadow(color: const Color(0xFF6366F1).withOpacity(0.4), blurRadius: 12, offset: const Offset(0, 4))]
                : null,
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(icon, color: selected ? Colors.white : const Color(0xFF64748B), size: 20),
              const SizedBox(width: 8),
              Text(
                label,
                style: TextStyle(
                  color: selected ? Colors.white : const Color(0xFF64748B),
                  fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}