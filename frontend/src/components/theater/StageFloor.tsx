export function StageFloor() {
  return (
    <div className="absolute bottom-0 left-0 right-0 h-28 pointer-events-none z-10">
      {/* Base warm wood color */}
      <div className="absolute inset-0"
        style={{
          background: 'linear-gradient(180deg, hsl(28, 40%, 18%) 0%, hsl(25, 35%, 14%) 40%, hsl(22, 30%, 10%) 100%)',
        }}
      />

      {/* Wood grain — horizontal streaks */}
      <div className="absolute inset-0 opacity-[0.15]"
        style={{
          backgroundImage: `
            repeating-linear-gradient(
              92deg,
              transparent 0px,
              rgba(180, 130, 70, 0.12) 2px,
              transparent 4px,
              rgba(160, 110, 50, 0.08) 8px,
              transparent 12px,
              rgba(200, 150, 80, 0.06) 20px,
              transparent 28px
            )
          `,
        }}
      />

      {/* Wood plank seams — wide horizontal boards */}
      {[0, 18, 38, 58, 78].map((top) => (
        <div key={top} className="absolute left-0 right-0"
          style={{
            top: `${top}%`,
            height: '2px',
            background: 'linear-gradient(90deg, rgba(0,0,0,0.2), rgba(60,40,20,0.15) 20%, rgba(0,0,0,0.25) 50%, rgba(60,40,20,0.15) 80%, rgba(0,0,0,0.2))',
          }}
        />
      ))}

      {/* Vertical plank joints — staggered */}
      {[15, 35, 52, 70, 88].map((left, i) => (
        <div key={left} className="absolute top-0 bottom-0"
          style={{
            left: `${left}%`,
            width: '1px',
            background: `rgba(0,0,0,0.12)`,
            height: i % 2 === 0 ? '50%' : '50%',
            top: i % 2 === 0 ? '0%' : '50%',
          }}
        />
      ))}

      {/* Warm wood tonal variation — knots and color shifts */}
      <div className="absolute inset-0 opacity-[0.08]"
        style={{
          backgroundImage: `
            radial-gradient(ellipse 120px 40px at 20% 30%, rgba(200, 150, 70, 0.4) 0%, transparent 100%),
            radial-gradient(ellipse 80px 30px at 60% 60%, rgba(180, 120, 50, 0.3) 0%, transparent 100%),
            radial-gradient(ellipse 100px 35px at 85% 20%, rgba(220, 170, 90, 0.3) 0%, transparent 100%)
          `,
        }}
      />

      {/* Center spotlight reflection on wood */}
      <div className="absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse 45% 90% at 50% 10%, rgba(255, 210, 130, 0.07) 0%, transparent 60%)',
        }}
      />

      {/* Front lip shadow */}
      <div className="absolute top-0 left-0 right-0 h-4"
        style={{
          background: 'linear-gradient(180deg, rgba(0,0,0,0.3) 0%, transparent 100%)',
        }}
      />

      {/* Front edge bevel */}
      <div className="absolute bottom-0 left-0 right-0 h-2"
        style={{
          background: 'linear-gradient(180deg, hsl(25, 30%, 12%) 0%, hsl(20, 25%, 6%) 100%)',
          borderTop: '1px solid rgba(180, 130, 70, 0.08)',
        }}
      />
    </div>
  );
}
