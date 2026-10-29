import type { ReactNode, MouseEvent } from "react";
import "./AP_Modal.css";

type AP_ModalProps = {
  open: boolean;
  title: string;
  body: ReactNode;
  actions: ReactNode;
  onClose: () => void;
  className?: string;
};

export function AP_Modal({ open, title, body, actions, onClose, className = "" }: AP_ModalProps) {
  if (!open) {
    return null;
  }

  function closeFromBackdrop(event: MouseEvent<HTMLDivElement>) {
    if (event.target === event.currentTarget) {
      onClose();
    }
  }

  return (
    <div className="modal-backdrop" onClick={closeFromBackdrop}>
      <section aria-labelledby="modal-title" aria-modal="true" className={`modal-card ${className}`.trim()} role="dialog">
        <h2 id="modal-title">{title}</h2>
        <div className="modal-body">{body}</div>
        <div className="modal-actions">{actions}</div>
      </section>
    </div>
  );
}
