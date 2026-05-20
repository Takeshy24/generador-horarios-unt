# Handoff de Desarrollo Frontend: Generador de Horarios UNT

Este documento proporciona las especificaciones técnicas necesarias para la implementación de la interfaz de usuario basada en el estilo **Academic SaaS Minimalist**.

## 1. Sistema de Diseño

### Tipografía
- **Fuente Principal**: Geist (Sans-serif).
- **Jerarquía**:
  - `font-headline-lg`: 32px / Bold (Títulos de página)
  - `font-headline-md`: 24px / Semibold (Títulos de sección)
  - `font-body-md`: 16px / Regular (Texto general)
  - `font-label-md`: 14px / Medium (Navegación y etiquetas)

### Paleta de Colores
- **Primario (Azul UNT)**: `#0052cc` (Marca y acciones principales)
- **Superficie**: `#f9f9ff` (Fondo de página)
- **Contenedores**: `#ffffff` (Tarjetas y paneles blancos)
- **Bordes**: `#d3daef` (Divisores y contornos suaves)
- **Texto**:
  - On-Surface: `#1a1c1e` (Cuerpo y títulos)
  - On-Surface-Variant: `#44474e` (Texto secundario/ayuda)

### Espaciado (Tailwind Based)
- **Gutter**: `px-gutter` (Normalmente 24px o 32px en desktop)
- **Stack Vertical**: `gap-4` (16px) entre elementos de lista, `gap-6` (24px) entre secciones.
- **Padding Contenedores**: `p-6` (24px).

### Bordes y Sombras
- **Roundness**: `rounded-lg` (8px) para tarjetas y botones. `rounded-full` para avatars.
- **Sombras**: Estilo plano (*Flat*). Usar elevación sutil `shadow-sm` solo en elementos flotantes o modales.

### Modo Claro/Oscuro
- El sistema utiliza variables CSS para el cambio de tema.
- El fondo en modo oscuro cambia a `bg-inverse-surface` (Gris muy oscuro/Azul oscuro).

---

## 2. Componentes Reutilizables

### SideNavBar (Lateral)
- **Propósito**: Navegación principal entre módulos.
- **Props**: `tabs` (Array de iconos y labels), `activeTabId`, `isCollapsible`.
- **Estados**: Hover (cambio de fondo sutil), Active (borde lateral izquierdo primario).
- **Variantes**: Full (expandido) y Mini (colapsado para maximizar espacio).

### DataTable (Tablas de Gestión)
- **Propósito**: Visualización de cursos, docentes y aulas.
- **Props**: `data`, `columns`, `pagination`, `filters`.
- **Estados**: Loading (Skeleton rows), Empty (Ilustración vacía), Error.
- **Variantes**: Con y sin checkboxes de selección masiva.

### StatusBadge (Etiquetas de Estado)
- **Propósito**: Indicar estados como "Habilitada", "Inactiva", "D.E.", "T.C.".
- **Variantes**: Success (Verde), Warning (Amarillo), Error (Rojo), Info (Azul).

### GridSchedule (Horario)
- **Propósito**: Visualización semanal del horario.
- **Props**: `timeSlots`, `days`, `events`.
- **Interacciones**: Click en evento para ver detalles, drag-to-select para disponibilidad.

---

## 3. Layout Global

- **Sidebar**: Fijo a la izquierda (`w-64` expandido, `w-20` colapsado).
- **Header**: Barra superior fija con breadcrumbs, buscador global y perfil de usuario.
- **Navegación**: Basada en roles. El menú lateral filtra opciones según si el usuario es Admin, Director o Docente.
- **Responsive**: 
  - Desktop: Sidebar visible.
  - Tablet/Mobile: Sidebar oculto (drawer), navegación inferior o menú hamburguesa.

---

## 4. UX (Experiencia de Usuario)

### Flujos Principales
1. **Admin**: CRUD de catálogo -> Configuración de parámetros de algoritmo.
2. **Director**: Monitoreo -> Asignación de carga (doble panel) -> Generación de Horario.
3. **Docente**: Declaración de Disponibilidad -> Preferencias de Dictado -> Consulta de Horario.

### Estados Vacíos & Carga
- **Skeleton Loading**: Utilizar en tablas y tarjetas de estadísticas durante la hidratación de datos.
- **Empty States**: Mensaje claro ("No hay cursos registrados") con botón de acción inmediata ("Añadir Curso").

### Validaciones y Feedback
- **Validación Inline**: En formularios de Cursos/Aulas para evitar códigos duplicados.
- **Toasts**: Notificaciones de éxito/error al guardar cambios o generar el horario.

---

## 5. Estructura Frontend Sugerida / usa la existente


## 6. Fases de Implementación

- **Fase 1: Fundación y Auth**: Configuración del sistema de diseño (Tailwind config), componentes básicos (botones, inputs) y pantallas de login.
- **Fase 2: Gestión de Catálogo**: Implementación de tablas y formularios para Cursos, Docentes y Aulas.
- **Fase 3: Módulos de Usuario**: Declaración de disponibilidad para docentes y paneles de asignación para directores.
- **Fase 4: Motor y Visualización**: Implementación de la vista de Horario Generado, Reportes y ajustes finales de UX.