# App móvil - Bitácora de Asistencia (Flutter)

App para el celular de la oficina: cualquier empleado se para frente a la
cámara, elige Entrada o Salida, y el sistema lo reconoce automáticamente.

## Cómo integrar estos archivos

Estos son solo los archivos `lib/` y la configuración — **no un proyecto
Flutter completo** (los proyectos Flutter dependen de mucho código nativo
generado que no tiene sentido escribir a mano). Para integrarlos:

```bash
# 1. Crea el proyecto base de Flutter
flutter create attendance_mobile
cd attendance_mobile

# 2. Reemplaza la carpeta lib/ generada por la que te compartí
#    (borra la lib/ que vino con flutter create y copia esta)

# 3. Reemplaza pubspec.yaml por el que te compartí

# 4. Instala las dependencias
flutter pub get

# 5. Agrega los permisos de cámara:
#    - Abre android/app/src/main/AndroidManifest.xml y agrega las líneas
#      indicadas en AndroidManifest.xml.snippet
#    - Abre ios/Runner/Info.plist y agrega la clave indicada en
#      Info.plist.snippet

# 6. Corre la app (con un emulador o celular conectado)
flutter run
```

## Configuración del servidor

La primera vez que abras la app, en la pantalla de login toca
"Configurar servidor" e ingresa la URL de tu backend:

- Si usas el **emulador de Android**, `http://10.0.2.2:8000/api` ya
  apunta automáticamente al `localhost` de tu PC (viene por defecto).
- Si usas un **celular físico** en la misma red WiFi que tu PC, usa la
  IP de tu PC en la red local, por ejemplo `http://192.168.1.10:8000/api`.

## Usuario del dispositivo

Usa el mismo superusuario que creaste en el backend
(`python manage.py createsuperuser`) para la primera prueba. Más adelante,
cuando definas roles, puedes crear un usuario específico solo para este
dispositivo desde el panel de administración de Django.

## Flujo de la app

1. **Login** (una sola vez, o cuando expire la sesión) — usa la cuenta
   del dispositivo.
2. **Pantalla de marcación** — el empleado elige Entrada o Salida, toca
   el botón, la cámara se abre, toma la foto, y la app la envía al
   backend. El backend reconoce al empleado y confirma la marcación.

## Siguientes pasos sugeridos

- Modo "kiosko" (bloquear la app en pantalla completa sin poder salir)
  para cuando instalen el tablet fijo en la entrada.
- Mostrar una miniatura de la foto tomada antes de enviarla, por si
  quieren repetir la captura.
- Sonido/vibración al confirmar la marcación, útil en un ambiente con
  varias personas pasando rápido.
