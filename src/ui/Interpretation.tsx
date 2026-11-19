import type { MemoryProfile, Sourced, VisualMode } from '../memory/types';

const SOUND_NAMES: Record<string, string> = {
  rain: 'Rain', wind: 'Wind', waves: 'Waves', birds: 'Birdsong', city: 'Distant traffic', crickets: 'Insects at night',
  hum: 'A low room hum', clock: 'A ticking clock', music: 'Faint music', voices: 'Murmured voices',
};

interface Row { label: string; value: string; detail?: string }

function row(label: string, s: Sourced<string>, fmt = (v: string) => v): Row {
  return { label, value: fmt(s.value), detail: s.source === 'visitor' ? (s.evidence ? (s.evidence.startsWith('chosen') ? s.evidence : `from “${s.evidence}”`) : undefined) : s.reason };
}

/** Splits a profile into what came from the visitor and what the system imagined. */
export function splitProfile(p: MemoryProfile) {
  const mine: Row[] = []; const ours: Row[] = [];
  const put = (s: Sourced<string>, r: Row) => (s.source === 'visitor' ? mine : ours).push(r);
  put(p.environment, row('Place', p.environment));
  put(p.time, row('Light', p.time));
  put(p.weather, row('Weather', p.weather));
  put(p.mood, row('Mood', p.mood));
  p.objects.forEach((o) => put(o, { label: 'Object', value: o.label, detail: o.source === 'visitor' ? (o.evidence ? `from “${o.evidence}”` : undefined) : o.reason }));
  p.sounds.forEach((s) => put(s, row('Sound', s, (v) => SOUND_NAMES[v] ?? v)));
  p.unclear.forEach((u) => mine.push({ label: 'Forgotten', value: u, detail: 'shown as frosted, unreadable glass' }));
  ours.push({ label: 'Palette', value: p.palette.name, detail: p.palette.reason });
  ours.push({ label: 'Form', value: p.mode.value === 'world' ? 'A world to walk through' : p.mode.value === 'painting' ? 'A painting to look at' : 'An object to hold', detail: p.mode.reason });
  ours.push({ label: 'Tone', value: p.emotionalTone });
  return { mine, ours };
}

export function Breakdown({ profile, compact = false }: { profile: MemoryProfile; compact?: boolean }) {
  const { mine, ours } = splitProfile(profile);
  return (
    <div className={`breakdown ${compact ? 'compact' : ''}`}>
      <div className="col">
        <p className="meta col-head"><span className="key key-visitor" /> From your words</p>
        {mine.length === 0 && <p className="empty">Nothing yet. Everything here was imagined.</p>}
        <ul>{mine.map((r, i) => <li key={i}><span className="meta">{r.label}</span><span className="val">{r.value}</span>{r.detail && <span className="det">{r.detail}</span>}</li>)}</ul>
      </div>
      <div className="col">
        <p className="meta col-head"><span className="key key-inferred" /> Artistic interpretation</p>
        <ul>{ours.map((r, i) => <li key={i}><span className="meta">{r.label}</span><span className="val">{r.value}</span>{r.detail && <span className="det">{r.detail}</span>}</li>)}</ul>
      </div>
    </div>
  );
}

export function Interpretation({ profile, notice, onGenerate, onEdit }: { profile: MemoryProfile; notice: string | null; onGenerate: (mode: VisualMode) => void; onEdit: () => void }) {
  const c = profile.palette.colors;
  return (
    <section className="interpretation">
      <header>
        <p className="meta">Interpretation · {profile.interpreter === 'llm' ? 'language model' : 'on this device'}</p>
        <h2 className="serif">{profile.title}</h2>
        <p className="tone serif"><em>{profile.emotionalTone}</em></p>
        <div className="palette" aria-label={`Palette: ${profile.palette.name}`}>
          {c.map((col, i) => <span key={i} style={{ background: col }} title={col} />)}
          <span className="meta">{profile.palette.name}</span>
        </div>
      </header>
      {notice && <p className="notice">{notice}</p>}
      <Breakdown profile={profile} />
      <p className="disclaimer">
        This is an artistic interpretation, not a reconstruction. It cannot recover what you have forgotten, and it does not know what really happened.
      </p>
      <div className="form-actions">
        <button className="btn btn-quiet" onClick={onEdit}>Change the description</button>
        <button className="btn btn-quiet" onClick={() => onGenerate('painting')}>Paint it</button>
        <button className="btn btn-primary" onClick={() => onGenerate(profile.mode.value === 'painting' ? 'object' : profile.mode.value)}>
          Give it form · {profile.mode.value === 'world' ? 'The World' : 'The Object'}
        </button>
      </div>
    </section>
  );
}
