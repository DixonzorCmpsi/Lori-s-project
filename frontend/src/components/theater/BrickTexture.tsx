/** Exposed brick wall texture — CSS-only, no images */
export function BrickTexture({ opacity = 0.25 }: { opacity?: number }) {
  return (
    <div className="absolute inset-0 pointer-events-none" style={{ opacity }}>
      {/* Brick pattern — alternating rows */}
      <div className="absolute inset-0"
        style={{
          backgroundImage: `
            linear-gradient(
              to right,
              rgba(145, 80, 50, 0.35) 0px, rgba(145, 80, 50, 0.35) 46px,
              rgba(60, 38, 25, 0.7) 46px, rgba(60, 38, 25, 0.7) 50px,
              rgba(155, 88, 55, 0.3) 50px, rgba(155, 88, 55, 0.3) 96px,
              rgba(60, 38, 25, 0.7) 96px, rgba(60, 38, 25, 0.7) 100px
            ),
            linear-gradient(
              to bottom,
              rgba(160, 95, 60, 0.25) 0px, rgba(160, 95, 60, 0.25) 20px,
              rgba(55, 35, 22, 0.8) 20px, rgba(55, 35, 22, 0.8) 23px,
              rgba(140, 78, 48, 0.25) 23px, rgba(140, 78, 48, 0.25) 43px,
              rgba(55, 35, 22, 0.8) 43px, rgba(55, 35, 22, 0.8) 46px
            )
          `,
          backgroundSize: '100px 46px',
        }}
      />

      {/* Offset every other row (half-brick stagger) */}
      <div className="absolute inset-0"
        style={{
          backgroundImage: `
            linear-gradient(
              to right,
              transparent 0px, transparent 21px,
              rgba(55, 35, 22, 0.6) 21px, rgba(55, 35, 22, 0.6) 25px,
              transparent 25px, transparent 71px,
              rgba(55, 35, 22, 0.6) 71px, rgba(55, 35, 22, 0.6) 75px,
              transparent 75px
            )
          `,
          backgroundSize: '100px 46px',
          backgroundPosition: '0 23px',
        }}
      />

      {/* Brick color variation — some warmer, some cooler */}
      <div className="absolute inset-0"
        style={{
          backgroundImage: `
            radial-gradient(ellipse 38px 16px at 25px 10px, rgba(180, 100, 60, 0.2) 0%, transparent 100%),
            radial-gradient(ellipse 38px 16px at 75px 33px, rgba(110, 60, 38, 0.18) 0%, transparent 100%),
            radial-gradient(ellipse 34px 14px at 50px 56px, rgba(170, 95, 55, 0.15) 0%, transparent 100%),
            radial-gradient(ellipse 40px 16px at 12px 78px, rgba(130, 70, 42, 0.2) 0%, transparent 100%)
          `,
          backgroundSize: '100px 92px',
        }}
      />

      {/* Mortar aging / wear */}
      <div className="absolute inset-0 opacity-40"
        style={{
          backgroundImage: `
            radial-gradient(circle 3px at 30% 20%, rgba(180, 160, 130, 0.2) 0%, transparent 100%),
            radial-gradient(circle 4px at 65% 45%, rgba(180, 160, 130, 0.15) 0%, transparent 100%),
            radial-gradient(circle 3px at 45% 75%, rgba(180, 160, 130, 0.18) 0%, transparent 100%),
            radial-gradient(circle 2px at 80% 85%, rgba(180, 160, 130, 0.12) 0%, transparent 100%)
          `,
          backgroundSize: '150px 120px',
        }}
      />
    </div>
  );
}
