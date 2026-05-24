import type { ComponentType, SVGProps } from "react";
import { Globe, MapPin, MessageCircle, Music2 } from "lucide-react";
import type { SocialPlatform } from "../lib/socialLinks";

type IconProps = SVGProps<SVGSVGElement>;

function strokeIcon(props: IconProps) {
  return {
    xmlns: "http://www.w3.org/2000/svg",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.75,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    ...props,
  };
}

function InstagramIcon(props: IconProps) {
  return (
    <svg {...strokeIcon(props)} aria-hidden>
      <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
    </svg>
  );
}

function FacebookIcon(props: IconProps) {
  return (
    <svg {...strokeIcon(props)} aria-hidden>
      <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
    </svg>
  );
}

const PLATFORM_ICONS: Record<SocialPlatform, ComponentType<IconProps>> = {
  instagram: InstagramIcon,
  facebook: FacebookIcon,
  tiktok: Music2,
  whatsapp: MessageCircle,
  website: Globe,
  waze: MapPin,
};

export default function SocialPlatformIcon({
  platform,
  className = "h-5 w-5",
  ...props
}: IconProps & { platform: SocialPlatform }) {
  const Icon = PLATFORM_ICONS[platform];
  return <Icon className={className} {...props} />;
}
