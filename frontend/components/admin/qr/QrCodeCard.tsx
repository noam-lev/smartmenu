"use client";

import { QRCodeSVG } from "qrcode.react";
import { useMemo } from "react";

const QR_SIZE = 200;
const LOGO_RATIO = 0.22;

type QrCodeCardProps = {
  value: string;
  logoSrc: string;
  title: string;
  label: string;
};

export default function QrCodeCard({
  value,
  logoSrc,
  title,
  label,
}: QrCodeCardProps) {
  const logoSize = Math.round(QR_SIZE * LOGO_RATIO);

  const imageSettings = useMemo(() => {
    const settings: {
      src: string;
      height: number;
      width: number;
      excavate: boolean;
      crossOrigin?: "anonymous";
    } = {
      src: logoSrc,
      height: logoSize,
      width: logoSize,
      excavate: true,
    };
    if (!logoSrc.startsWith("data:")) {
      settings.crossOrigin = "anonymous";
    }
    return settings;
  }, [logoSrc, logoSize]);

  return (
    <article className="qr-print-cell flex flex-col items-center">
      <QRCodeSVG
        value={value}
        size={QR_SIZE}
        level="H"
        marginSize={2}
        title={title}
        imageSettings={imageSettings}
        className="rounded-lg bg-white"
      />
      <p className="qr-print-label mt-3 text-center text-sm font-semibold text-zinc-900">{label}</p>
    </article>
  );
}
