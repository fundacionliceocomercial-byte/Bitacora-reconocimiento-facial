import 'dart:convert';
import 'dart:io';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import 'app_config.dart';

class ApiException implements Exception {
  final String message;
  ApiException(this.message);
  @override
  String toString() => message;
}

class CheckInResult {
  final int logId;
  final String message;
  final String employeeName;
  final String logType;
  CheckInResult({
    required this.logId,
    required this.message,
    required this.employeeName,
    required this.logType,
  });
}

class ApiService {
  static const _keyAccess = 'access_token';
  static const _keyRefresh = 'refresh_token';

  Future<bool> isLoggedIn() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString(_keyAccess) != null;
  }

  Future<void> logout() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_keyAccess);
    await prefs.remove(_keyRefresh);
  }

  Future<void> login(String username, String password) async {
    final apiUrl = await AppConfig.getApiUrl();
    final res = await http.post(
      Uri.parse('$apiUrl/auth/login/'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({'username': username, 'password': password}),
    );

    if (res.statusCode != 200) {
      throw ApiException('Usuario o contraseña incorrectos.');
    }

    final data = jsonDecode(res.body);
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_keyAccess, data['access']);
    await prefs.setString(_keyRefresh, data['refresh']);
  }

  Future<bool> _refreshToken() async {
    final prefs = await SharedPreferences.getInstance();
    final refresh = prefs.getString(_keyRefresh);
    if (refresh == null) return false;

    final apiUrl = await AppConfig.getApiUrl();
    final res = await http.post(
      Uri.parse('$apiUrl/auth/refresh/'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({'refresh': refresh}),
    );
    if (res.statusCode != 200) return false;

    final data = jsonDecode(res.body);
    await prefs.setString(_keyAccess, data['access']);
    return true;
  }

  /// Envía la foto capturada. El backend determina automáticamente si es
  /// ENTRADA o SALIDA según el último registro del empleado, y rechaza la
  /// marcación (429) si todavía está dentro del período de cooldown.
  /// Reintenta una vez si el token de acceso expiró.
  Future<CheckInResult> facialCheckIn(File photo, {bool retry = true}) async {
    final apiUrl = await AppConfig.getApiUrl();
    final prefs = await SharedPreferences.getInstance();
    final token = prefs.getString(_keyAccess);
    if (token == null) throw ApiException('No hay sesión activa. Inicia sesión primero.');

    final request = http.MultipartRequest('POST', Uri.parse('$apiUrl/attendance/facial-checkin/'))
      ..headers['Authorization'] = 'Bearer $token'
      ..files.add(await http.MultipartFile.fromPath('photo', photo.path));

    final streamed = await request.send();
    final res = await http.Response.fromStream(streamed);

    if (res.statusCode == 401 && retry) {
      final refreshed = await _refreshToken();
      if (refreshed) return facialCheckIn(photo, retry: false);
      throw ApiException('La sesión expiró. Vuelve a iniciar sesión.');
    }

    final data = jsonDecode(utf8.decode(res.bodyBytes));

    if (res.statusCode == 201) {
      return CheckInResult(
        logId: data['log']['id'],
        message: data['detail'],
        employeeName: data['log']['employee_name'],
        logType: data['log']['log_type'],
      );
    }

    // 400: sin rostro / varios rostros. 404: no reconocido. 429: cooldown.
    throw ApiException(data['detail'] ?? 'No se pudo registrar la marcación.');
  }

  /// Guarda (o reemplaza) la observación de un registro puntual.
  /// Se usa justo después de un check-in exitoso, desde el botón
  /// "Agregar observación".
  Future<void> addNote(int logId, String notes, {bool retry = true}) async {
    final apiUrl = await AppConfig.getApiUrl();
    final prefs = await SharedPreferences.getInstance();
    final token = prefs.getString(_keyAccess);
    if (token == null) throw ApiException('No hay sesión activa.');

    final res = await http.patch(
      Uri.parse('$apiUrl/attendance/$logId/notes/'),
      headers: {
        'Authorization': 'Bearer $token',
        'Content-Type': 'application/json',
      },
      body: jsonEncode({'notes': notes}),
    );

    if (res.statusCode == 401 && retry) {
      final refreshed = await _refreshToken();
      if (refreshed) return addNote(logId, notes, retry: false);
      throw ApiException('La sesión expiró. Vuelve a iniciar sesión.');
    }

    if (res.statusCode != 200) {
      throw ApiException('No se pudo guardar la observación.');
    }
  }
}