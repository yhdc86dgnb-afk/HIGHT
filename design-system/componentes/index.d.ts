import * as React from "react";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** primary = relleno ink (por defecto) · secondary = contorno · metal = plata cepillada (CTA de marca, home y campaña) · drop = relleno aura, uno por vista · ghost = enlace subrayado */
  variant?: "primary" | "secondary" | "metal" | "drop" | "ghost";
  size?: "md" | "lg";
  /** Ocupa todo el ancho del contenedor (ficha de producto en móvil, checkout). */
  block?: boolean;
  children: React.ReactNode;
}
export declare function Button(props: ButtonProps): JSX.Element;

export interface TagProps {
  tone?: "neutral" | "ink" | "drop" | "success" | "warning" | "danger";
  /** Texto corto, se muestra en MAYÚSCULAS mono. */
  children: React.ReactNode;
  className?: string;
}
export declare function Tag(props: TagProps): JSX.Element;

export interface PriceProps {
  /** Valor en pesos colombianos, sin decimales. */
  amount: number;
  /** Precio anterior; si es mayor que amount se muestra tachado y amount en aura. */
  compareAt?: number;
  size?: "md" | "lg";
  className?: string;
}
export declare function Price(props: PriceProps): JSX.Element;

export interface SizeOption { label: string; available?: boolean; }
export interface SizeSelectorProps {
  sizes: Array<SizeOption | string>;
  value?: string | null;
  defaultValue?: string;
  onChange?: (size: string) => void;
  /** Leyenda del grupo; por defecto "Talla". */
  label?: string;
  className?: string;
}
export declare function SizeSelector(props: SizeSelectorProps): JSX.Element;

export interface ProductCardProps {
  name: string;
  price: number;
  compareAt?: number;
  /** Corte · material, en mono. Ej: "Boxy · 280 g/m²". */
  meta?: string;
  image?: string;
  imageAlt?: string;
  href?: string;
  /** Marquilla sobre la foto: "DROP 04", "ÚLTIMAS 5". */
  tag?: string;
  tagTone?: TagProps["tone"];
  colors?: Array<{ name: string; value: string }>;
  className?: string;
}
export declare function ProductCard(props: ProductCardProps): JSX.Element;

export interface FieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  hint?: string;
  /** Mensaje de error: qué pasó y cómo arreglarlo. */
  error?: string;
}
export declare function Field(props: FieldProps): JSX.Element;

export interface NoticeProps {
  tone?: "info" | "success" | "warning" | "danger";
  title?: string;
  children: React.ReactNode;
  className?: string;
}
export declare function Notice(props: NoticeProps): JSX.Element;

export interface ContactFrame {
  src?: string;
  alt?: string;
  /** Letra de toma; se muestra "(A)". */
  take?: string;
  /** Número del fotograma; por defecto la posición a dos dígitos. */
  n?: string | number;
  orientation?: "landscape" | "portrait";
}
export interface ContactSheetProps {
  frames: ContactFrame[];
  /** column (por defecto, tira vertical) o row. */
  direction?: "column" | "row";
  /** Ancho de un fotograma horizontal en px; los verticales usan el 55 %. */
  width?: number;
  className?: string;
}
export declare function ContactSheet(props: ContactSheetProps): JSX.Element;

export interface IndexItem { n?: number | string; title: string; category?: string; year?: string | number; href?: string; }
export interface IndexListProps {
  items: IndexItem[];
  /** Encabezado sin paréntesis; se muestra "(Trabajo seleccionado)". */
  heading?: string;
  className?: string;
}
export declare function IndexList(props: IndexListProps): JSX.Element;

export interface EditorialSpreadProps {
  /** Foto oscura; se vira a cianotipo (azul de Prusia). Sin foto, fondo prussian. */
  image?: string;
  imageAlt?: string;
  /** Una frase, justificada a todo el ancho en serif itálica. */
  quote: string;
  leftLabel?: string;
  rightLabel?: string;
  /** Por defecto "3 / 4". */
  ratio?: string;
  className?: string;
}
export declare function EditorialSpread(props: EditorialSpreadProps): JSX.Element;

/** Nombres de Google (Material Symbols) redibujados con la estética Espina, más los cuatro de cuidado textil. */
export type GoogleIconName = "add" | "arrow_back" | "arrow_forward" | "chat_bubble" | "check" | "checkroom" | "chevron_left" | "chevron_right" | "close" | "credit_card" | "expand_less" | "expand_more" | "favorite" | "flare" | "grain" | "grid_view" | "info" | "iron" | "lavar_frio" | "local_laundry_service" | "local_shipping" | "location_on" | "lock" | "mail" | "menu" | "music_note" | "no_blanquear" | "no_secadora" | "open_in_new" | "person" | "planchar_bajo" | "remove" | "search" | "shopping_bag" | "straighten" | "swap_vert" | "timer" | "title" | "tune" | "undo" | "videocam" | "visibility" | "warning";
/** Nombres en español del set anterior: siguen funcionando y apuntan al ícono de Google equivalente. */
export type IconAlias = "bolsa" | "buscar" | "usuario" | "cerrar" | "flecha-der" | "flecha-izq" | "chevron-abajo" | "chevron-arriba" | "chevron-der" | "chevron-izq" | "mas" | "menos" | "corazon" | "envio" | "devolucion" | "regla" | "alerta" | "filtro" | "ordenar" | "estrella" | "candado" | "tarjeta" | "ubicacion" | "correo" | "chat" | "externo" | "cuadricula" | "ojo" | "lavar-frio" | "no-blanquear" | "planchar-bajo" | "no-secadora";
export type IconName = GoogleIconName | IconAlias;
export interface IconProps {
  /** Nombre de Google (`shopping_bag`) o alias en español (`bolsa`). */
  name: IconName;
  /** px; por defecto 24. Usa 20, 24, 32 o 48; 16 solo para add, remove, close y expand_more. */
  size?: 16 | 20 | 24 | 32 | 48 | number;
  /** Texto para lectores de pantalla. Sin label, el ícono es decorativo. */
  label?: string;
  className?: string;
}
/** Relleno en currentColor: hereda el color del texto. */
export declare function Icon(props: IconProps): JSX.Element;

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: IconName;
  /** Obligatorio: describe la acción ("Abrir menú"). */
  label: string;
  /** Número entre paréntesis junto al ícono, p. ej. unidades en el carrito. */
  badge?: number;
}
export declare function IconButton(props: IconButtonProps): JSX.Element;

export interface TitularProps {
  /** Texto corto en mayúsculas (máximo 3 palabras). La fuente solo tiene mayúsculas: las minúsculas salen en mayúscula. */
  children: React.ReactNode;
  /** xl 144px (campaña, portada) · l 88px (redes, separadores; por defecto) · m 48px (mínimo en pantalla). */
  size?: "xl" | "l" | "m";
  /** Versión Hueso, con poros como el logo. Siempre a tamaño xl (160px). */
  hueso?: boolean;
  /** Etiqueta HTML; por defecto h2. */
  as?: "h1" | "h2" | "h3" | "p" | "span" | "div";
  className?: string;
  style?: React.CSSProperties;
}
/** Titular en Hight Espina, la tipografía gótica del logo. Solo campaña, portadas y gráfica; nunca en la interfaz de compra. */
export declare function Titular(props: TitularProps): JSX.Element;

export interface LogoProps { /** Alto en px; el ancho es 4× el alto. */ height?: number; className?: string; }
/** Palabra HIGHT en contornos, color currentColor. */
export declare function Logo(props: LogoProps): JSX.Element;

export interface AnnouncementBarProps {
  /** ink (por defecto) · metal (plata cepillada) · aura (solo el día de un drop). */
  tone?: "ink" | "metal" | "aura";
  children: React.ReactNode;
  href?: string;
  linkLabel?: string;
  className?: string;
}
export declare function AnnouncementBar(props: AnnouncementBarProps): JSX.Element;

export interface NavLink { label: string; href?: string; current?: boolean; }
export interface HeaderProps {
  links?: NavLink[];
  cartCount?: number;
  /** Fondo de plata cepillada suave en vez de surface-000. */
  metal?: boolean;
  homeHref?: string;
  onMenu?: () => void; onSearch?: () => void; onAccount?: () => void; onCart?: () => void;
  className?: string;
}
export declare function Header(props: HeaderProps): JSX.Element;

export interface FooterColumn { title: string; links: NavLink[]; }
export interface FooterProps {
  columns?: FooterColumn[];
  /** Muestra el formulario de correo para drops. */
  newsletter?: boolean;
  onSubscribe?: () => void;
  tagline?: string;
  year?: number;
  className?: string;
}
export declare function Footer(props: FooterProps): JSX.Element;

export interface QuantityStepperProps { value?: number; defaultValue?: number; min?: number; max?: number; onChange?: (n: number) => void; label?: string; className?: string; }
export declare function QuantityStepper(props: QuantityStepperProps): JSX.Element;

export interface CartLineProps {
  name: string;
  /** Precio unitario en COP; se multiplica por quantity. */
  price: number;
  quantity?: number;
  /** "Talla M · Plata". */
  meta?: string;
  image?: string; imageAlt?: string;
  max?: number;
  onQuantity?: (n: number) => void;
  /** Pasa null para ocultar el botón de quitar. */
  onRemove?: (() => void) | null;
  className?: string;
}
export declare function CartLine(props: CartLineProps): JSX.Element;

export interface CartDrawerProps {
  open?: boolean;
  /** Dibuja el drawer en su lugar, sin fondo fijo (documentación y maquetas). */
  inline?: boolean;
  onClose?: () => void;
  onCheckout?: () => void;
  subtotal?: number;
  /** Monto para envío gratis; muestra cuánto falta. */
  freeShippingFrom?: number;
  count?: number;
  /** CartLine por producto. Sin hijos muestra el estado vacío. */
  children?: React.ReactNode;
}
export declare function CartDrawer(props: CartDrawerProps): JSX.Element | null;

export interface ModalProps { open?: boolean; inline?: boolean; title: string; onClose?: () => void; size?: "md" | "lg"; actions?: React.ReactNode; children: React.ReactNode; }
export declare function Modal(props: ModalProps): JSX.Element | null;

export interface ToastProps {
  tone?: "info" | "success" | "warning" | "danger";
  children: React.ReactNode;
  action?: { label: string; onClick?: () => void };
  onClose?: () => void;
  inline?: boolean;
  className?: string;
}
export declare function Toast(props: ToastProps): JSX.Element;

export interface EmptyStateProps { icon?: IconName; title: string; children?: React.ReactNode; action?: { label: string; onClick?: () => void }; className?: string; }
export declare function EmptyState(props: EmptyStateProps): JSX.Element;

export interface SkeletonProps { variant?: "line" | "block" | "card"; width?: string | number; height?: string | number; className?: string; }
export declare function Skeleton(props: SkeletonProps): JSX.Element;

export interface AccordionItem { title: string; content: React.ReactNode; }
export interface AccordionProps { items: AccordionItem[]; /** Índice abierto al cargar. */ defaultOpen?: number; multiple?: boolean; className?: string; }
export declare function Accordion(props: AccordionProps): JSX.Element;

export interface CheckboxProps extends React.InputHTMLAttributes<HTMLInputElement> { label: string; /** Cantidad de resultados del filtro. */ count?: number; }
export declare function Checkbox(props: CheckboxProps): JSX.Element;
export interface RadioProps extends React.InputHTMLAttributes<HTMLInputElement> { label: string; }
export declare function Radio(props: RadioProps): JSX.Element;
export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> { label: string; options: Array<string | { value: string; label: string }>; hint?: string; }
export declare function Select(props: SelectProps): JSX.Element;

export interface ColorOption { name: string; /** Color real de la tela, en hex. */ value: string; available?: boolean; }
export interface ColorSelectorProps { colors: ColorOption[]; value?: string; defaultValue?: string; onChange?: (name: string) => void; className?: string; }
export declare function ColorSelector(props: ColorSelectorProps): JSX.Element;

export interface ProductGalleryProps { images?: Array<{ src?: string; alt?: string }>; className?: string; }
export declare function ProductGallery(props: ProductGalleryProps): JSX.Element;

export interface SizeGuideRow { label: string; values: Array<string | number>; }
export interface SizeGuideProps { title?: string; note?: string; sizes: string[]; rows: SizeGuideRow[]; /** Talla resaltada (la que el cliente tiene seleccionada). */ highlight?: string; className?: string; }
export declare function SizeGuide(props: SizeGuideProps): JSX.Element;

/** Nombres de Google de todos los íconos disponibles. */
export declare const icons: GoogleIconName[];
/** Alias en español → nombre de Google. */
export declare const iconAliases: Record<IconAlias, GoogleIconName>;

/** Formatea un número como precio COP: 189000 → "$189.000". */
export declare function formatCOP(n: number): string;
