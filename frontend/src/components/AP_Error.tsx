import { AP_Button } from "./AP_Button";
import "./AP_Error.css";

type AP_ErrorProps = {
  message: string;
  onRetry?: () => void;
};

export function AP_Error({ message, onRetry }: AP_ErrorProps) {
  return (
    <div aria-live="polite" className="ap-error" role="alert">
      <p>{message}</p>
      {onRetry && <AP_Button onClick={onRetry} size="small" variant="secondary">Try again</AP_Button>}
    </div>
  );
}
