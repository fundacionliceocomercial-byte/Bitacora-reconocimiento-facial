# Backend - Sistema de Bitácora de Ingreso/Salida con Reconocimiento Facial

Reemplaza la bitácora mensual en Excel por un sistema con reconocimiento
facial. Backend en Django + DRF, base de datos Neon (Postgres), listo para
ser consumido desde React (web) y Flutter (app móvil).

## 1. Instalación local

```bash
cd backend
python -m venv venv
source venv/bin/activate   # En Windows: venv\Scripts\activate

# face_recognition depende de dlib (compila con cmake + un compilador C++).
# En Linux: sudo apt install cmake build-essential
# En Windows: instala "Visual Studio Build Tools" y cmake antes de este paso.
pip install -r requirements.txt

cp .env.example .env
# Edita .env y pega tu connection string de Neon en DATABASE_URL
```

## 2. Base de datos (Neon)

1. Crea un proyecto en https://neon.tech
2. Copia la "Connection string" (con `?sslmode=require`) y pégala en `.env`
   como `DATABASE_URL`.
3. Corre las migraciones:

```bash
python manage.py makemigrations
python manage.py migrate
python manage.py createsuperuser
```

## 3. Levantar el servidor

```bash
python manage.py runserver
```

- Admin: http://localhost:8000/admin/
- API: http://localhost:8000/api/

## 4. Flujo de uso de la API

1. **Login** → `POST /api/auth/login/` con `{ "username", "password" }`
   → devuelve `access` y `refresh` (JWT). Usa el `access` como
   `Authorization: Bearer <token>` en el resto de peticiones.

2. **Crear empleado** → `POST /api/employees/`
   ```json
   { "document_id": "1234567", "first_name": "Ana", "last_name": "Pérez", "department": "Sistemas" }
   ```

3. **Enrolar su rostro** (una sola vez, con una foto clara y de frente) →
   `POST /api/employees/{id}/enroll-face/` (multipart/form-data, campo `photo`)

4. **Marcar entrada/salida con la cámara** (desde React o Flutter) →
   `POST /api/attendance/facial-checkin/` (multipart/form-data)
   ```
   photo: <foto tomada en el momento>
   log_type: ENTRADA | SALIDA
   ```
   El backend identifica al empleado comparando el rostro contra los
   encodings guardados y crea el registro automáticamente.

5. **Consultar la bitácora mensual** (reemplaza la planilla de Excel) →
   `GET /api/attendance/monthly/?year=2026&month=9`
   Opcional: `&employee=<id>` para filtrar por persona.

## 5. Notas de diseño / decisiones a sustentar en tu presentación

- **Por qué guardar el encoding y no la foto para comparar**: comparar
  vectores de 128 números es mucho más rápido y preciso que comparar
  imágenes directamente, y es el enfoque estándar en reconocimiento facial.
- **Tolerancia (`FACE_MATCH_TOLERANCE`)**: controla qué tan estricta es la
  coincidencia. Se recomienda probar entre 0.4 (muy estricto) y 0.6
  (default de la librería) según la iluminación de tu oficina.
- **Auditoría**: cada registro guarda la foto capturada en el momento y el
  `match_confidence`, para poder revisar casos dudosos.
- **Siguientes pasos sugeridos**:
  - Endpoint de exportación a Excel/PDF de la bitácora mensual (para
    mantener el formato que ya usa la empresa, si lo necesitan).
  - Notificaciones (llegadas tarde, ausencias) vía correo o WhatsApp.
  - Dashboard en React con estadísticas (horas trabajadas, tardanzas).
  - Liveness detection (detectar que es una persona real y no una foto)
    antes de pasar a producción, por seguridad.
