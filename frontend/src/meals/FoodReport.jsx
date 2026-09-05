import { useEffect, useState } from "react";
import { Bar, BarChart, Cell, ReferenceLine, ResponsiveContainer, XAxis } from "recharts";
import { getJSON } from "../api";
import { NUTRIENTS } from "./foodmath";
import { useLang } from "./i18n";

// The last 7 or 30 days: a bar per day against the kcal target line, the
// average over logged days, and how often the day landed on target.
export default function FoodReport({ onBack }) {
  const { t } = useLang();
  const [days, setDays] = useState(7);
  const [data, setData] = useState(null);

  useEffect(() => {
    setData(null);
    getJSON(`/api/food/report?days=${days}`).then((d) => d && setData(d));
  }, [days]);

  const target = data?.targets?.kcal || 0;
  const rows = (data?.days || []).map((d) => ({ ...d, label: d.day.slice(5) }));

  return (
    <section className="screen">
      <button type="button" className="kindback" onClick={onBack}>{t("back")}</button>
      <div className="panel">
        <div className="listhead">
          <p className="qnum">{t("report")}</p>
          <span className="viewswitch" style={{ margin: 0 }}>
            <button type="button" className={days === 7 ? "on" : ""} onClick={() => setDays(7)}>{t("days7")}</button>
            <button type="button" className={days === 30 ? "on" : ""} onClick={() => setDays(30)}>{t("days30")}</button>
          </span>
        </div>
        {!data ? (
          <p className="hint">{t("loading")}</p>
        ) : data.logged_days === 0 ? (
          <p className="hint">{t("noReport")}</p>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={rows} margin={{ top: 10, right: 2, bottom: 0, left: 2 }}>
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  interval={days > 7 ? "preserveStartEnd" : 0}
                  tick={{ fontSize: 10, fill: "currentColor", opacity: 0.5 }}
                />
                <ReferenceLine y={target} stroke="#e2b15f" strokeDasharray="3 3" />
                <Bar dataKey="kcal" radius={[3, 3, 0, 0]}>
                  {rows.map((r) => (
                    <Cell
                      key={r.day}
                      fill={!r.logged ? "#2a2e35" : Math.abs(r.kcal - target) <= 0.1 * target ? "#7f9d80" : r.kcal > target ? "#d98b5a" : "#4a5160"}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <div className="reportfacts">
              <div>
                <span className="qnum">{t("avgPerDay")}</span>
                <b>{Math.round(data.average.kcal)} <small>kcal</small></b>
                <small>P {Math.round(data.average.protein)} · C {Math.round(data.average.carbs)} · F {Math.round(data.average.fat)}</small>
              </div>
              <div>
                <span className="qnum">{t("onTarget")}</span>
                <b>{data.on_target_days} <small>/ {data.logged_days}</small></b>
                <small>{t("loggedDays")}: {data.logged_days} / {days}</small>
              </div>
            </div>
            <ul className="reportdays">
              {[...rows].reverse().filter((r) => r.logged).map((r) => (
                <li key={r.day}>
                  <span className="starnum">{r.label}</span>
                  <b>{Math.round(r.kcal)}</b>
                  <small>{NUTRIENTS.slice(1).map((n) => `${n[0].toUpperCase()} ${Math.round(r[n])}`).join(" · ")}</small>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </section>
  );
}
