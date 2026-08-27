import React from 'react';
import { FiCheckCircle, FiClock, FiDollarSign, FiFileText, FiShield, FiUsers } from 'react-icons/fi';

export function AuthContextPanel({ title = 'The Execution Circle', subtitle = 'Membership starts with commitment, proof, and review.' }) {
  const items = [
    { icon: <FiFileText />, label: 'Declare weekly goals', detail: 'Minimum 3 clear targets before the setup deadline.' },
    { icon: <FiCheckCircle />, label: 'Submit proof of work', detail: 'Progress only counts when evidence is attached.' },
    { icon: <FiShield />, label: 'Admin reviewed', detail: 'Moderators and admins verify before points are awarded.' },
    { icon: <FiDollarSign />, label: 'Wallet-backed accountability', detail: 'Members keep at least NGN 1,000 available for weekly commitment.' },
  ];

  return (
    <aside className="tec-auth-context" aria-label="Execution Circle membership context">
      <div className="tec-auth-context-kicker">TEC Weekly</div>
      <h1>{title}</h1>
      <p>{subtitle}</p>
      <div className="tec-auth-context-list">
        {items.map((item) => (
          <div className="tec-auth-context-item" key={item.label}>
            <span className="tec-auth-context-icon">{item.icon}</span>
            <span>
              <strong>{item.label}</strong>
              <small>{item.detail}</small>
            </span>
          </div>
        ))}
      </div>
    </aside>
  );
}

export function LiveMetricCard({ icon, label, value, detail, tone = 'primary' }) {
  return (
    <section className={`tec-live-metric tec-live-metric-${tone}`}>
      <div className="tec-live-metric-top">
        <span className="tec-live-metric-icon">{icon}</span>
        <span className="tec-live-metric-status">{detail}</span>
      </div>
      <strong>{value}</strong>
      <span>{label}</span>
    </section>
  );
}

export function WeekIdentityChip({ weekId, mode = 'public' }) {
  return (
    <span className={`tec-week-chip tec-week-chip-${mode}`}>
      <FiClock />
      <span>{weekId}</span>
    </span>
  );
}

export function CircleStatusChip({ children = 'Execution Circle' }) {
  return (
    <span className="tec-circle-chip">
      <FiUsers />
      <span>{children}</span>
    </span>
  );
}
