import { AP_Button } from "./AP_Button";
import "./AP_PageHeader.css";

type AP_PageHeaderProps = {
  title: string;
  description: string;
  action?: { label: string; onClick: () => void };
};

export function AP_PageHeader({ title, description, action }: AP_PageHeaderProps) {
  return (
    <div className="page-heading">
      <div>
        <div className="breadcrumbs">Workspace <span>/</span> {title}</div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action && (
        <AP_Button onClick={action.onClick}>
          <span>+</span> {action.label}
        </AP_Button>
      )}
    </div>
  );
}
