import 'package:shared_preferences/shared_preferences.dart';

/// Guarda la URL del backend en el propio dispositivo, para que se pueda
/// configurar una sola vez (por ejemplo, la IP del servidor en la oficina)
/// sin tener que recompilar la app.
class AppConfig {
  static const _keyApiUrl = 'api_base_url';
  static const defaultApiUrl = 'http://10.0.2.2:8000/api'; // emulador Android -> localhost del PC

  static Future<String> getApiUrl() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString(_keyApiUrl) ?? defaultApiUrl;
  }

  static Future<void> setApiUrl(String url) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_keyApiUrl, url.trim());
  }
}
