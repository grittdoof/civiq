import {
  Gavel, Wallet, HardHat, Building2, MapPin,
  Trees, GraduationCap, Heart, Users, ShieldCheck,
  Lightbulb, Calendar, Briefcase, Landmark,
  type LucideIcon,
} from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  Gavel, Wallet, HardHat, Building2, MapPin,
  Trees, GraduationCap, Heart, Users, ShieldCheck,
  Lightbulb, Calendar, Briefcase, Landmark,
};

interface Props {
  name: string;
  size?: number;
  strokeWidth?: number;
  className?: string;
  color?: string;
}

export default function CommissionIcon({
  name, size = 16, strokeWidth = 1.75, className, color,
}: Props) {
  const Icon = ICONS[name] ?? Gavel;
  return <Icon size={size} strokeWidth={strokeWidth} className={className} color={color} />;
}
