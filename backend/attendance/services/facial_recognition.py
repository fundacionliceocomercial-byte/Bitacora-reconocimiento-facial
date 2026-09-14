"""
Servicio de reconocimiento facial.

Aísla toda la lógica de la librería `face_recognition` (basada en dlib) del
resto de la aplicación. Si en el futuro se quiere cambiar a otro motor
(por ejemplo DeepFace, un servicio cloud, etc.) solo hay que reescribir
este archivo, sin tocar vistas ni modelos.
"""
from dataclasses import dataclass
from typing import Optional

import face_recognition
import numpy as np
from django.conf import settings

from attendance.models import Employee


class NoFaceDetectedError(Exception):
    """No se detectó ningún rostro en la imagen enviada."""


class MultipleFacesDetectedError(Exception):
    """Se detectó más de un rostro en la imagen; se requiere una sola persona."""


@dataclass
class MatchResult:
    employee: Optional[Employee]
    confidence: float  # 1.0 = coincidencia perfecta, 0.0 = sin parecido


def extract_encoding(image_file) -> list:
    """
    Recibe un archivo de imagen (InMemoryUploadedFile o ruta) y devuelve
    el encoding facial (lista de 128 floats) del único rostro detectado.
    """
    image = face_recognition.load_image_file(image_file)
    face_locations = face_recognition.face_locations(image)

    if len(face_locations) == 0:
        raise NoFaceDetectedError("No se detectó ningún rostro en la imagen.")
    if len(face_locations) > 1:
        raise MultipleFacesDetectedError(
            "Se detectó más de un rostro. Envía una foto con una sola persona."
        )

    encodings = face_recognition.face_encodings(image, known_face_locations=face_locations)
    return encodings[0].tolist()


def find_matching_employee(image_file, tolerance: float = None) -> MatchResult:
    """
    Compara el rostro presente en `image_file` contra los encodings de
    todos los empleados activos y devuelve el mejor match, si existe.
    """
    tolerance = tolerance if tolerance is not None else settings.FACE_MATCH_TOLERANCE

    unknown_encoding = np.array(extract_encoding(image_file))

    employees = Employee.objects.filter(
        status=Employee.Estado.ACTIVO, face_encoding__isnull=False
    )

    if not employees.exists():
        return MatchResult(employee=None, confidence=0.0)

    known_encodings = []
    known_employees = []
    for emp in employees:
        known_encodings.append(np.array(emp.face_encoding))
        known_employees.append(emp)

    distances = face_recognition.face_distance(known_encodings, unknown_encoding)
    best_index = int(np.argmin(distances))
    best_distance = float(distances[best_index])

    # face_recognition trabaja con "distancia" (menor = más parecido).
    # La convertimos a un score de confianza legible entre 0 y 1.
    confidence = max(0.0, 1.0 - best_distance)

    if best_distance <= tolerance:
        return MatchResult(employee=known_employees[best_index], confidence=confidence)

    return MatchResult(employee=None, confidence=confidence)
