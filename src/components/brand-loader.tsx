type Size = "sm" | "md" | "lg";

const OUTER: Record<Size, string> = {
  sm: "h-8 w-8",
  md: "h-12 w-12",
  lg: "h-16 w-16",
};
const ICON_PX: Record<Size, number> = { sm: 16, md: 22, lg: 30 };
const RING: Record<Size, string> = {
  sm: "border-[1.5px]",
  md: "border-2",
  lg: "border-[2.5px]",
};

export function BrandLoader({ size = "md" }: { size?: Size }) {
  return (
    <div className={`relative ${OUTER[size]}`}>
      <div
        className={`absolute inset-0 animate-spin rounded-full ${RING[size]} border-brand/20 border-t-brand`}
      />
      <div className="absolute inset-0 flex items-center justify-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/brand/contentgate/icon-color.svg"
          width={ICON_PX[size]}
          height={ICON_PX[size]}
          alt=""
        />
      </div>
    </div>
  );
}
