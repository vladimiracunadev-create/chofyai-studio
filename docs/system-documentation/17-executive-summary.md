# 17 · Resumen ejecutivo

> Estado: completo · Última revisión: 2026-08-27 · Versión analizada: 0.5.1 (commit f840055)

Documento para quien tiene que decidir algo sobre este proyecto —invertir tiempo, adoptarlo,
auditarlo o continuarlo— sin necesidad de leer el código.

## 1. Qué es

ChofyAI Studio es una aplicación de escritorio para macOS que instala, arranca y supervisa
herramientas de inteligencia artificial que funcionan **enteramente en el computador del
usuario**. Cubre cinco áreas: voz, transcripción, imagen, música y video.

No es un modelo de IA ni compite con las herramientas que instala: es la capa de
orquestación que hace que instalarlas y usarlas sea cuestión de pulsar un botón en lugar de
seguir un tutorial de veinte pasos que falla a la mitad.

## 2. Qué necesidad cubre

Las mejores herramientas de IA local son gratuitas y abiertas, pero su instalación es
hostil: entornos de Python que chocan, binarios que hay que compilar, modelos de varios
gigabytes, puertos que colisionan y procesos que quedan colgados. El resultado habitual es
que la gente lo intenta, falla y abandona.

El proyecto documenta diez incidentes reales de ese tipo en su postmortem interno, y el
código actual contiene la mitigación de cada uno. Ese es el valor: no la idea de un
lanzador, sino los detalles que hacen que funcione la segunda vez.

## 3. Quién lo usa

- Creadores de contenido en Mac que quieren voz, imagen o música generada sin depender de
  servicios de pago.
- Usuarios para los que la privacidad es un requisito: nada de lo que producen sale del
  equipo.
- Desarrolladores que necesitan probar y desechar herramientas sin ensuciar su sistema.
- Usuarios con discos externos, para quienes el manejo de volúmenes es una función central y
  no un detalle.

No está pensado para equipos, servidores ni entornos multiusuario: no tiene cuentas, roles
ni API remota.

## 4. Capacidades principales

| Capacidad | Estado |
|:---|:---|
| Instalación de cinco herramientas con progreso en vivo | Operativa |
| Arranque, parada, reinicio y actualización de procesos | Operativa |
| Comprobación de salud y recuperación de procesos huérfanos | Operativa |
| Interfaz de cada herramienta embebida en la propia ventana | Operativa |
| Soporte de discos externos con reserva automática y montaje de imagen APFS | Operativa |
| Reubicación de herramientas a cualquier ruta | Operativa |
| Descarga y borrado guiado de modelos | Operativa |
| Estadísticas del sistema en vivo | Operativa |
| Cola de instalación por lotes | Operativa |
| Catálogo de herramientas adicionales (marketplace) | Parcial: genera manifiestos que hay que completar a mano |
| Workflows entre herramientas y constructor visual | Parcial: dos de tres workflows son ejecutables |
| Interfaz en español e inglés, temas claro y oscuro, atajos | Operativa |
| Soporte de Windows | Experimental: scripts escritos, sin validación de extremo a extremo |
| Soporte de Linux | No implementado, pese a estar declarado en los manifiestos |

## 5. Tecnología

Tauri 2 con núcleo en Rust e interfaz React 18 con TypeScript. La elección de Tauri sobre
Electron da una aplicación mucho más liviana y un backend nativo real. El núcleo tiene sólo
seis dependencias externas, algo poco habitual y deliberado.

La orquestación es declarativa: cada herramienta se describe en un archivo YAML y se instala
con un script de shell. Añadir una herramienta nueva no requiere recompilar nada.

## 6. Arquitectura en un párrafo

Un único proceso contiene la interfaz web y un núcleo Rust; la interfaz sólo puede actuar a
través de 35 comandos explícitos. Ese núcleo decide dónde vive todo —con reserva automática
si el disco externo no está—, lee los manifiestos, lanza los scripts de instalación,
transmite su progreso en vivo y vigila los procesos resultantes, que escuchan en
`127.0.0.1` y cuya interfaz se embebe en la ventana. No hay base de datos: todo el estado
son archivos JSON, YAML y el árbol de directorios, inspeccionables con un editor de texto.

## 7. Estado actual

- Versión 0.5.1, con las cinco herramientas verificadas por el autor con inferencia real,
  según el postmortem del proyecto.
- Integración continua con cinco comprobaciones y un escaneo de seguridad semanal.
- Publicación automatizada del `.dmg` mediante GitHub Actions.
- Documentación previa abundante, ampliada ahora con este conjunto de 20 documentos.
- **20 pruebas de interfaz y 4 de backend**, todas correctas en la ejecución realizada
  durante este análisis. La cobertura real es baja: los dos archivos que concentran la
  lógica están prácticamente sin probar.

## 8. Fortalezas

1. **Resuelve un problema real y verificable.** Cada mecanismo defensivo del código responde
   a un fallo documentado, no a una hipótesis.
2. **Honestidad técnica.** El repositorio distingue lo validado de lo experimental y publica
   sus propios postmortems. Es poco común y facilita mucho auditarlo.
3. **Superficie de ataque acotada.** La interfaz sólo puede hacer lo que 35 comandos
   explícitos permiten.
4. **Dependencias mínimas y cadena de suministro cuidada**: pnpm fijado por Corepack,
   ejecución de scripts de instalación restringida, auditorías y análisis estático en CI.
5. **Privacidad por diseño.** Sin cuentas, sin telemetría, sin envío de datos: todo el
   tráfico de inferencia va a la interfaz de loopback.
6. **Estado transparente.** Todo es texto plano; el soporte no requiere herramientas
   especiales.

## 9. Riesgos

| Riesgo | Gravedad | Comentario |
|:---|:---|:---|
| Instala código de terceros sin fijar versiones | Alta | Es inherente al producto, pero hoy no hay commits fijados ni verificación de integridad; también rompe la promesa de instalación reproducible |
| Cobertura de pruebas casi nula donde está la lógica | Alta | Cualquier refactor de rutas o procesos es una apuesta |
| Cuatro números de versión distintos en el repositorio | Alta | Afecta a la confianza y al aviso de actualizaciones |
| Linux declarado pero no implementado | Alta para ese público | El usuario ve la herramienta disponible y falla al instalar |
| Mata procesos ajenos que ocupen un puerto declarado | Media | Puede cerrar otra aplicación del usuario sin aviso |
| Dependencia de un único mantenedor | Media | Todo el conocimiento reside en una persona |
| Estado escrito sin atomicidad y sin aviso ante corrupción | Media | El usuario puede perder su configuración en silencio |
| Aplicación sin firmar ni notarizar | Media | Fricción en la primera apertura para cualquier usuario nuevo |

El registro completo, con evidencia y prioridades, está en
[15 · Riesgos y deuda técnica](15-risks-and-technical-debt.md), y el análisis de seguridad
en [11 · Seguridad](11-security.md).

## 10. Oportunidades de mejora

1. **Fijar versiones de las herramientas de terceros.** Convertiría "instalación
   reproducible" de lema en hecho, y es un cambio acotado: un campo más en el manifiesto.
2. **Probar el núcleo.** Las funciones de resolución de rutas y validación son puras o casi
   puras: son las pruebas más baratas y de mayor retorno del proyecto.
3. **Cerrar la promesa multiplataforma en un sentido u otro.** Validar Windows o retirarlo
   de la interfaz; ambas opciones son mejores que el estado actual.
4. **Firmar y notarizar.** El procedimiento ya está documentado; sólo requiere una cuenta de
   desarrollador de Apple.
5. **Dividir el archivo de interfaz.** 2766 líneas son el mayor freno para que se incorpore
   otra persona.
6. **Completar el marketplace.** Hoy genera manifiestos incompletos; con un script de
   instalación genérico sería una función completa y diferencial.

## 11. Próximos pasos recomendados

En orden de retorno sobre esfuerzo:

| Orden | Acción | Esfuerzo | Beneficio |
|:---:|:---|:---|:---|
| 1 | Unificar las cuatro versiones y añadir una comprobación en CI | Bajo | Elimina un problema de confianza visible para el usuario |
| 2 | Quitar `linux-x64` de los manifiestos o crear los scripts | Bajo | Deja de prometer lo que no se cumple |
| 3 | Escribir pruebas reales para la guardia de rutas y para la resolución del Studio Home | Medio | Protege lo más crítico y lo más frágil |
| 4 | Escritura atómica del estado y aviso ante configuración corrupta | Bajo | Evita pérdidas silenciosas de configuración |
| 5 | Fijar commits de los repositorios de terceros | Medio | Reproducibilidad real y menor riesgo de suministro |
| 6 | Confirmar antes de matar un proceso ajeno | Bajo | Elimina el riesgo más molesto para el usuario |
| 7 | Firmar y notarizar la aplicación | Medio, con coste externo | Distribución sin fricción |
| 8 | Extraer los paneles de `App.tsx` a módulos | Alto | Habilita que trabaje más de una persona |

## 12. Conclusión

ChofyAI Studio es un proyecto **maduro en criterio y joven en verificación**. Las decisiones
de diseño son sólidas y están tomadas por alguien que se enfrentó a los problemas reales:
la resolución de rutas con reserva automática, la validación posterior a la instalación y la
detección de procesos huérfanos son mecanismos que sólo se le ocurren a quien ya se ha
quemado con ellos. La contrapartida es que casi nada de eso está protegido por pruebas, y
que la promesa multiplataforma va por delante de la implementación.

Para un usuario de Mac con Apple Silicon, el producto es hoy utilizable y resuelve un
problema real. Para un equipo que quiera adoptarlo o continuarlo, el trabajo previo está
identificado y acotado: es deuda conocida y documentada, no incógnitas. Esa diferencia es la
que hace que el proyecto sea recuperable por otra persona, que es exactamente lo que este
conjunto de documentación pretende garantizar.
