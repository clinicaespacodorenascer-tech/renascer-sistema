export const WHATSAPP_RENASCER = "5575983203429";

export function linkWhatsapp(mensagem) {
  return `https://wa.me/${WHATSAPP_RENASCER}?text=${encodeURIComponent(mensagem)}`;
}
