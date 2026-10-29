import "./AP_Success.css";

type AP_SuccessProps = {
  message: string;
  reference?: string;
};

export function AP_Success({ message, reference }: AP_SuccessProps) {
  return (
    <div aria-live="polite" className="ap-success" role="status">
      <strong>{message}</strong>
      {reference && <span>Reference {reference}</span>}
    </div>
  );
}
