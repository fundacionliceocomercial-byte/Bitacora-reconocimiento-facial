import 'package:flutter/material.dart';

class ResultBanner extends StatelessWidget {
  final bool success;
  final String message;

  const ResultBanner({super.key, required this.success, required this.message});

  @override
  Widget build(BuildContext context) {
    final color = success ? const Color(0xFF0F6E56) : Colors.red.shade700;
    final bg = success ? const Color(0xFFE1F5EE) : Colors.red.shade50;

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(12)),
      child: Row(
        children: [
          Icon(success ? Icons.check_circle : Icons.error_outline, color: color),
          const SizedBox(width: 12),
          Expanded(
            child: Text(message, style: TextStyle(color: color, fontWeight: FontWeight.w500)),
          ),
        ],
      ),
    );
  }
}
