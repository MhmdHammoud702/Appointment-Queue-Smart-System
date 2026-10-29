import "./AP_Loading.css";

type AP_LoadingProps = {
  label?: string;
};

export function AP_Loading({ label = "Loading appointments" }: AP_LoadingProps) {
  return (
    <div aria-label={label} aria-busy="true" className="ap-loading">
      <span className="loading-row" />
      <span className="loading-row" />
      <span className="loading-row" />
    </div>
  );
}
