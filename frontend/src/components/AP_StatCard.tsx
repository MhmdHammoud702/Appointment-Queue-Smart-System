import "./AP_StatCard.css";

type AP_StatCardProps = {
  title: string;
  value: string;
  detail: string;
  symbol: string;
  color: string;
};

export function AP_StatCard({ title, value, detail, symbol, color }: AP_StatCardProps) {
  return (
    <article className="stat-card">
      <div className={`stat-icon ${color}`}>{symbol}</div>
      <div className="stat-copy">
        <p>{title}</p>
        <strong>{value}</strong>
        <small>{detail}</small>
      </div>
      <span className="stat-arrow">↗</span>
    </article>
  );
}
