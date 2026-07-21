CERTIFICADOS DE LA GALERÍA
==========================

La galería 3D de la página lee el archivo "certificados.json" de esta carpeta.
Cada entrada del JSON pinta una tarjeta. Mientras no exista la imagen, la
tarjeta muestra un diseño limpio con el título, la fecha y el monto.

CÓMO PONER TUS CERTIFICADOS REALES
----------------------------------
1. Guarda cada captura de tu certificado FTMO como PNG o JPG.
2. Súbela a esta carpeta (assets/certificados/) con EXACTAMENTE el nombre que
   aparece en "img" dentro de certificados.json. Ejemplos:
       01-challenge.png
       02-verification.png
       03-reward.png
       ...
3. Cuando el archivo exista, la tarjeta mostrará tu imagen automáticamente.

EDITAR TÍTULOS, FECHAS Y MONTOS
-------------------------------
Abre certificados.json y cambia:
  - "title":  nombre del certificado (ej. "Passed FTMO Challenge")
  - "meta":   fecha (ej. "5 Feb 2026")
  - "amount": monto del reward (solo para tarjetas de tipo Reward)
  - "tag":    etiqueta de color: "Challenge", "Verification" o "Reward"

Puedes agregar o quitar entradas: la galería se adapta al número que haya.

IMPORTANTE
----------
Sube solo TUS propios certificados (resultados reales de DavidCapitalFX).
Son la prueba de tu trayectoria, no una promesa de rendimiento para alumnos.
