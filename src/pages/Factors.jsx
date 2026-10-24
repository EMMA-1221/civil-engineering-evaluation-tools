import { Fragment } from 'react';
import { PRODUCTIVITY_FACTORS } from '../productivityFactors';
import { formatProductivityPercent } from '../productivityModel';
import './ProductivityUI.css';

export default function Factors() {
  return <div className="hcg-tools hcg-prod hcg-prod-factors">
    <p className="prod-eyebrow">Productivity · Reference library</p>
    <h1 className="factor-title">Labor Productivity Factors</h1>
    <p className="factor-desc">The 19 factors available in your weekly analysis. Choose Minor, Moderate or Severe to use the corresponding percentage.</p>
    <div className="factor-tableWrapper" role="region" aria-label="Productivity factor reference table" tabIndex={0}>
      <table className="factor-table" aria-label="Labor productivity impact factors by severity">
        <thead><tr><th scope="col" className="factor-header">Productivity factor</th>{['Minor', 'Moderate', 'Severe'].map(level => <th scope="col" key={level} className="factor-header">{level}</th>)}</tr></thead>
        <tbody>{PRODUCTIVITY_FACTORS.map(factor => <Fragment key={factor.id}>
          <tr><th colSpan={4} scope="rowgroup" className="factor-categoryCell"><strong>{factor.label}</strong></th></tr>
          <tr><td className="factor-factorCell">{factor.description}{factor.note && <div>{factor.note}</div>}</td>{['minor', 'moderate', 'severe'].map(level => <td key={level} className={`factor-${level}Cell`}>{formatProductivityPercent(factor[level])}%{factor.notes[level] && <div className="factor-noteCell">{factor.notes[level]}</div>}</td>)}</tr>
        </Fragment>)}</tbody>
      </table>
    </div>
    <p className="prod-table-note">Values follow the source workbook, including negative impacts and decimal percentages. On smaller screens, scroll across to compare all three levels.</p>
  </div>;
}
