import { useEffect, useRef, useState } from "react";
import "./AP_Success.css";

type AP_SuccessProps = {
  message: string;
  reference?: string;
  onDismiss?: () => void;
};

export function AP_Success({ message, reference, onDismiss }: AP_SuccessProps) {
  const [visible, setVisible] = useState(true);
  const onDismissRef = useRef(onDismiss);

  useEffect(() => {
    onDismissRef.current = onDismiss;
  }, [onDismiss]);

  useEffect(() => {
    setVisible(true);
    const timer = window.setTimeout(() => {
      setVisible(false);
      onDismissRef.current?.();
    }, 4000);
    return () => window.clearTimeout(timer);
  }, [message, reference]);

  if (!visible) return null;

  return (
    <div aria-live="polite" className="ap-success" role="status">
      <strong>{message}</strong>
      {reference && <span>Reference {reference}</span>}
    </div>
  );
}
