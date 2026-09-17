import 'package:flutter/material.dart';

enum ScanVisualState { idle, scanning, capturing, success, error }

/// Marco de escaneo institucional: esquinas tipo lector biométrico, línea
/// de escaneo sutil, y un ícono de confirmación claro. Colores sobrios,
/// sin efectos neón, acorde a un sistema de control de acceso corporativo.
class ScanOverlay extends StatefulWidget {
  final ScanVisualState state;

  const ScanOverlay({super.key, required this.state});

  @override
  State<ScanOverlay> createState() => _ScanOverlayState();
}

class _ScanOverlayState extends State<ScanOverlay> with TickerProviderStateMixin {
  late final AnimationController _lineController;

  @override
  void initState() {
    super.initState();
    _lineController = AnimationController(vsync: this, duration: const Duration(milliseconds: 2000))..repeat(reverse: true);
  }

  @override
  void dispose() {
    _lineController.dispose();
    super.dispose();
  }

  Color _frameColor() {
    switch (widget.state) {
      case ScanVisualState.success:
        return const Color(0xFF16A34A);
      case ScanVisualState.error:
        return const Color(0xFFDC2626);
      case ScanVisualState.capturing:
        return const Color(0xFFD97706);
      case ScanVisualState.scanning:
        return const Color(0xFF0F6E56);
      case ScanVisualState.idle:
        return Colors.white38;
    }
  }

  @override
  Widget build(BuildContext context) {
    const size = Size(250, 320);
    final color = _frameColor();

    return SizedBox(
      width: size.width,
      height: size.height,
      child: Stack(
        alignment: Alignment.center,
        children: [
          SizedBox(
            width: size.width,
            height: size.height,
            child: CustomPaint(
              size: size,
              painter: _CornerBracketsPainter(color: color),
            ),
          ),

          // Línea de escaneo, sutil y discreta
          if (widget.state == ScanVisualState.scanning)
            ClipRRect(
              borderRadius: BorderRadius.circular(20),
              child: AnimatedBuilder(
                animation: _lineController,
                builder: (context, child) {
                  final y = 24 + _lineController.value * (size.height - 48);
                  return Stack(
                    children: [
                      Positioned(
                        top: y,
                        left: 24,
                        right: 24,
                        child: Container(
                          height: 1.5,
                          decoration: BoxDecoration(
                            color: color.withOpacity(0.55),
                            borderRadius: BorderRadius.circular(1),
                          ),
                        ),
                      ),
                    ],
                  );
                },
              ),
            ),

          // Ícono de resultado
          AnimatedSwitcher(
            duration: const Duration(milliseconds: 250),
            transitionBuilder: (child, anim) => ScaleTransition(
              scale: CurvedAnimation(parent: anim, curve: Curves.easeOut),
              child: FadeTransition(opacity: anim, child: child),
            ),
            child: widget.state == ScanVisualState.success
                ? Container(
                    key: const ValueKey('ok'),
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(color: color.withOpacity(0.12), shape: BoxShape.circle),
                    child: Icon(Icons.check, color: color, size: 48),
                  )
                : widget.state == ScanVisualState.error
                    ? Container(
                        key: const ValueKey('err'),
                        padding: const EdgeInsets.all(14),
                        decoration: BoxDecoration(color: color.withOpacity(0.12), shape: BoxShape.circle),
                        child: Icon(Icons.close, color: color, size: 48),
                      )
                    : widget.state == ScanVisualState.capturing
                        ? SizedBox(
                            key: const ValueKey('loading'),
                            width: 36,
                            height: 36,
                            child: CircularProgressIndicator(strokeWidth: 3, color: color),
                          )
                        : const SizedBox.shrink(key: ValueKey('none')),
          ),
        ],
      ),
    );
  }
}

/// Dibuja 4 esquinas tipo lector biométrico, con trazo limpio y sin brillo.
class _CornerBracketsPainter extends CustomPainter {
  final Color color;

  _CornerBracketsPainter({required this.color});

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = color
      ..strokeWidth = 3.5
      ..strokeCap = StrokeCap.round
      ..style = PaintingStyle.stroke;

    const bracket = 30.0;

    void corner(Offset a, Offset vertex, Offset b) {
      final path = Path()
        ..moveTo(a.dx, a.dy)
        ..lineTo(vertex.dx, vertex.dy)
        ..lineTo(b.dx, b.dy);
      canvas.drawPath(path, paint);
    }

    corner(Offset(0, bracket), const Offset(0, 0), Offset(bracket, 0));
    corner(Offset(size.width - bracket, 0), Offset(size.width, 0), Offset(size.width, bracket));
    corner(Offset(0, size.height - bracket), Offset(0, size.height), Offset(bracket, size.height));
    corner(Offset(size.width, size.height - bracket), Offset(size.width, size.height), Offset(size.width - bracket, size.height));
  }

  @override
  bool shouldRepaint(covariant _CornerBracketsPainter oldDelegate) => oldDelegate.color != color;
}