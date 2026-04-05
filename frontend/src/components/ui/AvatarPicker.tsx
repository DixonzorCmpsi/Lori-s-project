import { getInitials } from '@/utils/format';

export const AVATAR_OPTIONS = [
  { id: 'initials', label: 'Initials', icon: null },
  { id: 'theater-mask', label: 'Theater Mask', icon: '🎭' },
  { id: 'star', label: 'Star', icon: '⭐' },
  { id: 'music', label: 'Music', icon: '🎵' },
  { id: 'spotlight', label: 'Spotlight', icon: '🔦' },
  { id: 'microphone', label: 'Microphone', icon: '🎤' },
  { id: 'ticket', label: 'Ticket', icon: '🎟️' },
  { id: 'rose', label: 'Rose', icon: '🌹' },
  { id: 'crown', label: 'Crown', icon: '👑' },
  { id: 'drama', label: 'Drama', icon: '🎪' },
  { id: 'film', label: 'Film', icon: '🎬' },
  { id: 'palette', label: 'Palette', icon: '🎨' },
] as const;

export type AvatarId = typeof AVATAR_OPTIONS[number]['id'];

interface AvatarDisplayProps {
  avatarId: string | null | undefined;
  name: string | null | undefined;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizes = {
  sm: 'w-7 h-7 text-[10px]',
  md: 'w-8 h-8 text-xs',
  lg: 'w-12 h-12 text-lg',
};

/** Renders an avatar — either a preset icon or initials fallback */
export function AvatarDisplay({ avatarId, name, size = 'sm', className = '' }: AvatarDisplayProps) {
  const option = avatarId ? AVATAR_OPTIONS.find(o => o.id === avatarId) : null;
  const sizeClass = sizes[size];

  if (option && option.icon) {
    return (
      <div className={`${sizeClass} rounded-full flex items-center justify-center flex-shrink-0 ${className}`}
        style={{ background: 'linear-gradient(135deg, hsl(43,50%,30%), hsl(43,40%,22%))', }}>
        <span style={{ fontSize: size === 'lg' ? '24px' : size === 'md' ? '16px' : '14px' }}>{option.icon}</span>
      </div>
    );
  }

  return (
    <div className={`${sizeClass} rounded-full flex items-center justify-center font-semibold flex-shrink-0 ${className}`}
      style={{ background: 'linear-gradient(135deg, hsl(25,20%,20%), hsl(25,15%,15%))', color: 'hsl(25,10%,60%)' }}>
      {getInitials(name)}
    </div>
  );
}

interface AvatarPickerProps {
  selected: string | null;
  name: string | null | undefined;
  onSelect: (id: string) => void;
}

/** Grid of avatar options to pick from */
export function AvatarPicker({ selected, name, onSelect }: AvatarPickerProps) {
  return (
    <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
      {AVATAR_OPTIONS.map(opt => {
        const isSelected = (selected || 'initials') === opt.id;
        return (
          <button
            key={opt.id}
            onClick={() => onSelect(opt.id)}
            className="flex flex-col items-center gap-1 p-2 rounded-lg cursor-pointer transition-colors"
            style={{
              background: isSelected ? 'rgba(212,175,55,0.15)' : 'var(--t-subtle-bg)',
              border: `2px solid ${isSelected ? 'hsl(43,74%,49%)' : 'transparent'}`,
            }}
          >
            {opt.icon ? (
              <span style={{ fontSize: '24px' }}>{opt.icon}</span>
            ) : (
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold"
                style={{ background: 'linear-gradient(135deg, hsl(25,20%,20%), hsl(25,15%,15%))', color: 'hsl(25,10%,60%)' }}>
                {getInitials(name)}
              </div>
            )}
            <span className="text-[8px] uppercase tracking-wider" style={{ color: isSelected ? 'hsl(43,60%,55%)' : 'var(--t-subtle-text)' }}>
              {opt.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
