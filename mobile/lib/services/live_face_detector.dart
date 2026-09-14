import 'dart:io';
import 'dart:typed_data';
import 'dart:ui';
import 'package:camera/camera.dart';
import 'package:google_mlkit_face_detection/google_mlkit_face_detection.dart';
import 'package:flutter/services.dart';

/// Envuelve el detector de rostros de ML Kit y se encarga de convertir cada
/// frame que entrega la cámara (formato YUV/BGRA) al formato que ML Kit
/// necesita para analizarlo. Corre 100% en el celular, sin tocar el backend.
class LiveFaceDetector {
  final FaceDetector _detector = FaceDetector(
    options: FaceDetectorOptions(
      performanceMode: FaceDetectorMode.fast,
      minFaceSize: 0.25, // el rostro debe ocupar al menos ~25% del cuadro
    ),
  );

  /// Analiza un frame y devuelve `true` si hay exactamente un rostro,
  /// razonablemente centrado y de buen tamaño (listo para capturar).
  Future<bool> hasWellFramedFace({
    required CameraImage image,
    required CameraDescription camera,
    required DeviceOrientation deviceOrientation,
  }) async {
    final inputImage = _toInputImage(image, camera, deviceOrientation);
    if (inputImage == null) return false;

    final faces = await _detector.processImage(inputImage);
    if (faces.length != 1) return false;

    final face = faces.first;
    final box = face.boundingBox;
    final frameArea = image.width * image.height;
    final faceArea = box.width * box.height;

    // El rostro debe ocupar una porción razonable del cuadro (ni muy
    // lejos ni pegado a la cámara) para asegurar una buena captura.
    final ratio = faceArea / frameArea;
    return ratio > 0.05 && ratio < 0.8;
  }

  void dispose() {
    _detector.close();
  }

  InputImage? _toInputImage(
    CameraImage image,
    CameraDescription camera,
    DeviceOrientation deviceOrientation,
  ) {
    final rotation = _rotationFromCamera(camera, deviceOrientation);
    if (rotation == null) return null;

    final format = Platform.isAndroid
        ? InputImageFormat.nv21
        : InputImageFormat.bgra8888;

    if (Platform.isAndroid) {
      // Android entrega YUV420; concatenamos los planos para NV21.
      final allBytes = <int>[];
      for (final plane in image.planes) {
        allBytes.addAll(plane.bytes);
      }
      final bytes = Uint8List.fromList(allBytes);

      return InputImage.fromBytes(
        bytes: bytes,
        metadata: InputImageMetadata(
          size: Size(image.width.toDouble(), image.height.toDouble()),
          rotation: rotation,
          format: format,
          bytesPerRow: image.planes.first.bytesPerRow,
        ),
      );
    }

    // iOS entrega un solo plano BGRA8888.
    final plane = image.planes.first;
    return InputImage.fromBytes(
      bytes: plane.bytes,
      metadata: InputImageMetadata(
        size: Size(image.width.toDouble(), image.height.toDouble()),
        rotation: rotation,
        format: format,
        bytesPerRow: plane.bytesPerRow,
      ),
    );
  }

  InputImageRotation? _rotationFromCamera(
    CameraDescription camera,
    DeviceOrientation deviceOrientation,
  ) {
    return InputImageRotationValue.fromRawValue(camera.sensorOrientation);
  }
}
