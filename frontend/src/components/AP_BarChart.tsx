import "./AP_BarChart.css";

type AP_BarChartProps = {
  data: { date: string; count: number }[];
};

export function AP_BarChart({ data }: AP_BarChartProps) {
  const maxAppointments = Math.max(1, ...data.map((item) => item.count));
  return (
    <div className="chart" aria-label="Appointments for the past seven days">
      {data.map((item) => (
        <div className="chart-column" key={item.date}>
          <div className="chart-bar-track">
            <div
              className={`chart-bar ${item.date === new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Beirut" }).format(new Date()) ? "today" : ""}`}
              style={{ height: `${item.count === 0 ? 2 : (item.count / maxAppointments) * 100}%` }}
              title={`${item.count} appointments`}
            />
          </div>
          <span>{new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Beirut", weekday: "short" }).format(new Date(`${item.date}T12:00:00`))}</span>
        </div>
      ))}
    </div>
  );
}
