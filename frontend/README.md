# Panel web - Bitácora de Asistencia (React + Tailwind)

## Instalación

```bash
cd frontend
npm install
cp .env.example .env
# Verifica que VITE_API_URL apunte a tu backend Django (por defecto http://localhost:8000/api)
npm run dev
```

Abre http://localhost:5173

## Requisito en el backend

Asegúrate de que en el `.env` del backend, `CORS_ALLOWED_ORIGINS` incluya
`http://localhost:5173` (ya viene así por defecto en `.env.example`).

También necesitas un usuario para iniciar sesión — usa el que creaste con
`python manage.py createsuperuser` en el backend.

## Qué incluye

- **Login** (`/login`) — usa el endpoint JWT del backend.
- **Empleados** (`/empleados`) — crear, buscar, eliminar empleados, y
  registrar/actualizar su rostro (sube una foto → el backend genera el
  encoding automáticamente).
- **Bitácora** (`/bitacora`) — consulta mensual con filtro por mes/año,
  y botones para exportar a Excel o PDF.

## Siguientes pasos sugeridos

- Pantalla de "marcar asistencia" con cámara web en vivo (usando
  `getUserMedia`), para poder probar el reconocimiento facial desde el
  navegador sin depender aún de la app Flutter.
- Manejo de roles cuando definas los usuarios adicionales (el backend ya
  usa JWT + permisos de Django, así que se puede extender sin rehacer nada).
- Gráficos/estadísticas (tardanzas, horas trabajadas) en un dashboard.
