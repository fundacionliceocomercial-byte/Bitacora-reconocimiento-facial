import 'package:flutter/material.dart';

enum ScanVisualState { idle, scanning, capturing, success, error }

/// Marco de escaneo animado con efecto neón: esquinas tipo "Face ID" con
/// brillo, línea de escaneo en movimiento, y un ícono de confirmación que
/// aparece con una animación suave al terminar.
class ScanOverlay extends StatefulWidget {
  final ScanVisualState state;

  const ScanOverlay({super.key, required this.state});

  @override
  State<ScanOverlay> createState() => _ScanOverlayState();
}

class _ScanOverlayState extends State<ScanOverlay> with TickerProviderStateMixin {
  late final AnimationController _lineController;
  late final AnimationController _pulseController;

  @override
  void initState() {
    super.initState();
    _lineController = AnimationController(vsync: this, duration: const Duration(milliseconds: 1800))..repeat(reverse: true);
    _pulseController = AnimationController(vsync: this, duration: const Duration(milliseconds: 1200))..repeat(reverse: true);
  }

  @override
  void dispose() {
    _lineController.dispose();
    _pulseController.dispose();
    super.dispose();
  }

  Color _frameColor() {
    switch (widget.state) {
      case ScanVisualState.success:
        return const Color(0xFF34D399);
      case ScanVisualState.error:
        return const Color(0xFFF87171);
      case ScanVisualState.capturing:
        return const Color(0xFFFBBF24);
      case ScanVisualState.scanning:
        return const Color(0xFF22D3EE);
      case ScanVisualState.idle:
        return Colors.white70;
    }
  }

  @override
  Widget build(BuildContext context) {
    const size = Size(260, 330);
    final color = _frameColor();

    return SizedBox(
      width: size.width,
      height: size.height + 40,
      child: Stack(
        alignment: Alignment.topCenter,
        children: [
          Positioned(
            top: 20,
            child: AnimatedBuilder(
              animation: _pulseController,
              builder: (context, child) {
                final scale = widget.state == ScanVisualState.scanning
                    ? 1.0 + (_pulseController.value * 0.025)
                    : 1.0;
                return Transform.scale(scale: scale, child: child);
              },
              child: SizedBox(
                width: size.width,
                height: size.height,
                child: Stack(
                  alignment: Alignment.center,
                  children: [
                    // Halo de brillo detrás del marco
                    AnimatedContainer(
                      duration: const Duration(milliseconds: 400),
                      width: size.width - 20,
                      height: size.height - 20,
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(140),
                        boxShadow: [
                          BoxShadow(color: color.withOpacity(0.35), blurRadius: 60, spreadRadius: 10),
                        ],
                      ),
                    ),

                    SizedBox(
                      width: size.width,
                      height: size.height,
                      child: CustomPaint(
                        size: size,
                        painter: _CornerBracketsPainter(color: color),
                      ),
                    ),

                    // Línea de escaneo en movimiento
                    if (widget.state == ScanVisualState.scanning)
                      ClipRRect(
                        borderRadius: BorderRadius.circular(24),
                        child: AnimatedBuilder(
                          animation: _lineController,
                          builder: (context, child) {
                            final y = 20 + _lineController.value * (size.height - 40);
                            return Stack(
                              children: [
                                Positioned(
                                  top: y,
                                  left: 30,
                                  right: 30,
                                  child: Container(
                                    height: 3,
                                    decoration: BoxDecoration(
                                      borderRadius: BorderRadius.circular(2),
                                      gradient: LinearGradient(
                                        colors: [
                                          color.withOpacity(0),
                                          color,
                                          color.withOpacity(0),
                                        ],
                                      ),
                                      boxShadow: [
                                        BoxShadow(color: color.withOpacity(0.9), blurRadius: 14, spreadRadius: 2),
                                      ],
                                    ),
                                  ),
                                ),
                              ],
                            );
                          },
                        ),
                      ),

                    // Ícono de resultado (aparece con fundido + escala)
                    AnimatedSwitcher(
                      duration: const Duration(milliseconds: 300),
                      transitionBuilder: (child, anim) => ScaleTransition(
                        scale: CurvedAnimation(parent: anim, curve: Curves.easeOutBack),
                        child: FadeTransition(opacity: anim, child: child),
                      ),
                      child: widget.state == ScanVisualState.success
                          ? Container(
                              key: const ValueKey('ok'),
                              padding: const EdgeInsets.all(16),
                              decoration: BoxDecoration(
                                color: color.withOpacity(0.2),
                                shape: BoxShape.circle,
                                boxShadow: [BoxShadow(color: color.withOpacity(0.5), blurRadius: 24, spreadRadius: 2)],
                              ),
                              child: Icon(Icons.check_rounded, color: color, size: 56),
                            )
                          : widget.state == ScanVisualState.error
                              ? Container(
                                  key: const ValueKey('err'),
                                  padding: const EdgeInsets.all(16),
                                  decoration: BoxDecoration(
                                    color: color.withOpacity(0.2),
                                    shape: BoxShape.circle,
                                    boxShadow: [BoxShadow(color: color.withOpacity(0.5), blurRadius: 24, spreadRadius: 2)],
                                  ),
                                  child: Icon(Icons.priority_high_rounded, color: color, size: 56),
                                )
                              : widget.state == ScanVisualState.capturing
                                  ? SizedBox(
                                      key: const ValueKey('loading'),
                                      width: 44,
                                      height: 44,
                                      child: CircularProgressIndicator(strokeWidth: 3.5, color: color),
                                    )
                                  : const SizedBox.shrink(key: ValueKey('none')),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// Dibuja 4 esquinas tipo "marco de escaneo" (estilo Face ID / QR) con un
/// efecto de brillo neón (glow) detrás del trazo principal.
class _CornerBracketsPainter extends CustomPainter {
  final Color color;

  _CornerBracketsPainter({required this.color});

  @override
  void paint(Canvas canvas, Size size) {
    const bracket = 34.0;

    Path buildCornerPath(Offset a, Offset vertex, Offset b) {
      return Path()
        ..moveTo(a.dx, a.dy)
        ..lineTo(vertex.dx, vertex.dy)
        ..lineTo(b.dx, b.dy);
    }

    final corners = [
      buildCornerPath(Offset(0, bracket), const Offset(0, 0), Offset(bracket, 0)),
      buildCornerPath(Offset(size.width - bracket, 0), Offset(size.width, 0), Offset(size.width, bracket)),
      buildCornerPath(Offset(0, size.height - bracket), Offset(0, size.height), Offset(bracket, size.height)),
      buildCornerPath(Offset(size.width, size.height - bracket), Offset(size.width, size.height), Offset(size.width - bracket, size.height)),
    ];

    // Capa de brillo (glow): trazo ancho, borroso, semitransparente.
    final glowPaint = Paint()
      ..color = color.withOpacity(0.55)
      ..strokeWidth = 10
      ..strokeCap = StrokeCap.round
      ..style = PaintingStyle.stroke
      ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 8);

    // Trazo nítido encima del glow.
    final sharpPaint = Paint()
      ..color = color
      ..strokeWidth = 4.5
      ..strokeCap = StrokeCap.round
      ..style = PaintingStyle.stroke;

    for (final path in corners) {
      canvas.drawPath(path, glowPaint);
    }
    for (final path in corners) {
      canvas.drawPath(path, sharpPaint);
    }
  }

  @override
  bool shouldRepaint(covariant _CornerBracketsPainter oldDelegate) => oldDelegate.color != color;
}