import { useState } from 'react';
import { getAssetLogo } from '@/utils/assetLogos';

interface AssetLogoProps {
  ticker: string;
  name?: string;
  institution?: string;
  assetType?: string;
  className?: string;
  sizeClassName?: string;
  badgeBgColor?: string;
  badgeTextColor?: string;
}

export function AssetLogo({
  ticker,
  name,
  institution,
  assetType,
  className = '',
  sizeClassName = 'h-9 w-9',
  badgeBgColor,
  badgeTextColor,
}: AssetLogoProps) {
  const [hasError, setHasError] = useState(false);
  const logoUrl = getAssetLogo(ticker, institution, assetType);

  const cleanTicker = ticker ? ticker.toUpperCase() : '??';
  const displayInitials = cleanTicker.replace(/[^A-Z0-9]/g, '').slice(0, 3) || cleanTicker.slice(0, 3);

  if (hasError || !logoUrl) {
    return (
      <div
        className={`flex items-center justify-center rounded-lg font-bold text-xs shrink-0 select-none shadow-xs border border-gray-200 bg-gray-100 text-gray-800 ${sizeClassName} ${className}`}
        style={{
          backgroundColor: badgeBgColor,
          color: badgeTextColor,
        }}
        title={name || ticker}
      >
        {displayInitials}
      </div>
    );
  }

  return (
    <div
      className={`relative flex items-center justify-center rounded-lg shrink-0 overflow-hidden bg-white border border-gray-200/90 shadow-xs p-1 ${sizeClassName} ${className}`}
      title={name || ticker}
    >
      <img
        src={logoUrl}
        alt={ticker}
        className="h-full w-full object-contain rounded-md"
        loading="lazy"
        onError={() => setHasError(true)}
      />
    </div>
  );
}
