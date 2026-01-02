import React from "react";

function Factors() {
  const factorsData = [
    {
      category: "Overmanning",
      description: "An increase of the peak number of workers of the same trait above the planned or estimated peak. Estimated peak typically equal to 1.6 the average number of workers.",
      minor: "22%",
      moderate: "23%",
      severe: "34%"
    },
    {
      category: "Overtime",
      subcategory: "The work that exceeds 8 hours/day and 40 hours/week.",
      items: [
        {
          description: "Overtime 5-10",
          minor: "5%",
          moderate: "20%",
          severe: "30%",
          note: "(10 hrs/day, 5 days/week)"
        },
        {
          description: "Overtime 6-10",
          minor: "4%",
          moderate: "20%",
          severe: "40%",
          note: "(10 hrs/day, 6 days/week)"
        }
      ]
    },
    {
      category: "Second Shift",
      description: "The hours worked by a second group of craftsmen whose work is performed after the first work force of the same trade has retired for the day.",
      minor: "-5%",
      moderate: "10%",
      severe: "17%"
    },
    {
      category: "Stacking of Trades",
      description: "Considers the total number of craftsmen from all trades working in a given area. The worker density (sq. ft./worker) depends on the available net working area and the number of workers from all crafts. The net working area is the total floor space minus any unusable portions, such as a production line, elevator shaft, and permanent fixtures.",
      minor: "24%",
      moderate: "28%",
      severe: "32%"
    },
    {
      category: "Out-of-Sequence work",
      description: "An activity or a series of activities that is not performed according to baseline logical and productive planned sequence.",
      minor: "13%",
      moderate: "31%",
      severe: "28%"
    },
    {
      category: "Weather",
      description: "Impact of temperature and humidity on labor output.",
      minor: "0%",
      moderate: "20%",
      severe: "40%",
      minorNote: "(40°F, 80°F)",
      moderateNote: "(0°F, 100°F)",
      severeNote: "(-10°F, 110°F)"
    },
    {
      category: "Owner-Furnished Items",
      description: "Includes both material and equipment that are bought and supplied to the specialty contractor by the owner (any part providing materials or equipment) or possibly the general contractor. See Figure 3.14 for further details.",
      minor: "4%",
      moderate: "11%",
      severe: "18%"
    },
    {
      category: "Access Constraints",
      description: "Access constraints are experienced when the work area is unavailable, partially available, or not in a condition to be used by workers.",
      minor: "17%",
      moderate: "25%",
      severe: "32%"
    },
    {
      category: "Beneficial Occupancy",
      description: "The situation in which a contractor must work in close proximity to an owner's production equipment or personnel.",
      minor: "12%",
      moderate: "20%",
      severe: "28%"
    },
    {
      category: "Loss of Learning",
      description: "Loss of learning is encountered when highly repetitive operations are interrupted or personnel are changed, with the new personnel will slowly learning the operations.",
      minor: "21%",
      moderate: "29%",
      severe: "32%"
    },
    {
      category: "Change Order Processing Time",
      description: "The period of time between initiation of the change order and the owner's approval of the change order for the majority of change items experienced on the project.",
      minor: "0%",
      moderate: "10%",
      severe: "15%",
      minorNote: "(> 1 week)",
      moderateNote: "(3-4 weeks)",
      severeNote: "(5 weeks)"
    },
    {
      category: "Absenteeism",
      description: "",
      minor: "2%",
      moderate: "22%",
      severe: "40%",
      minorNote: "(5% absenteeism)",
      moderateNote: "(10% absenteeism)",
      severeNote: "(20% absenteeism)"
    },
    {
      category: "Dilution of Supervision",
      description: "This occurs when supervisors are diverted from productive work as a result of high crew levels and change order work.",
      minor: "25%",
      moderate: "28%",
      severe: "31%"
    },
    {
      category: "Percent Design Complete Prior to Construction",
      description: "Percentage of the design complete prior to construction.",
      minor: "1%",
      moderate: "10%",
      severe: "18%",
      minorNote: "(98% design)",
      moderateNote: "(80% design)",
      severeNote: "(60% design)"
    },
    {
      category: "AE Coordination Prior to Construction",
      description: "Coordination with the architect/engineer prior to construction.",
      minor: "2%",
      moderate: "8%",
      severe: "14%"
    },
    {
      category: "AE Support During Construction",
      description: "Support provided by the architect/engineer during construction.",
      minor: "1%",
      moderate: "10%",
      severe: "20%"
    },
    {
      category: "Manpower Shortage During Construction",
      description: "",
      minor: "2%",
      moderate: "8%",
      severe: "14%"
    }
  ];

  const renderRow = (factor, index) => {
    if (factor.items) {
      // Category with subcategory and multiple items
      return (
        <React.Fragment key={index}>
          <tr style={styles.categoryRow}>
            <td colSpan="4" style={styles.categoryCell}><strong>{factor.category}</strong></td>
          </tr>
          {factor.subcategory && (
            <tr>
              <td colSpan="4" style={styles.descriptionCell}>{factor.subcategory}</td>
            </tr>
          )}
          {factor.items.map((item, idx) => (
            <React.Fragment key={`${index}-${idx}`}>
              <tr>
                <td style={styles.factorCell}>{item.description}</td>
                <td style={styles.minorCell}>{item.minor}</td>
                <td style={styles.moderateCell}>{item.moderate}</td>
                <td style={styles.severeCell}>{item.severe}</td>
              </tr>
              {item.note && (
                <tr>
                  <td style={styles.factorCell}></td>
                  <td colSpan="3" style={styles.noteCell}>{item.note}</td>
                </tr>
              )}
            </React.Fragment>
          ))}
        </React.Fragment>
      );
    } else {
      // Simple category
      const hasNotes = factor.minorNote || factor.moderateNote || factor.severeNote;
      return (
        <React.Fragment key={index}>
          <tr style={styles.categoryRow}>
            <td colSpan="4" style={styles.categoryCell}><strong>{factor.category}</strong></td>
          </tr>
          <tr>
            <td style={styles.factorCell}>{factor.description}</td>
            <td style={styles.minorCell}>{factor.minor}</td>
            <td style={styles.moderateCell}>{factor.moderate}</td>
            <td style={styles.severeCell}>{factor.severe}</td>
          </tr>
          {hasNotes && (
            <tr>
              <td style={styles.factorCell}></td>
              <td style={styles.noteCell}>{factor.minorNote || ""}</td>
              <td style={styles.noteCell}>{factor.moderateNote || ""}</td>
              <td style={styles.noteCell}>{factor.severeNote || ""}</td>
            </tr>
          )}
        </React.Fragment>
      );
    }
  };

  return (
    <div style={styles.page}>
      <h1 style={styles.title}>Labor Productivity Factors</h1>
      <p style={styles.desc}>
        Review quantified factors affecting labor productivity for electrical contractors.
      </p>

      <div style={styles.tableWrapper}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.header}>Productivity Factor</th>
              <th style={styles.header}>Minor</th>
              <th style={styles.header}>Moderate</th>
              <th style={styles.header}>Severe</th>
            </tr>
          </thead>
          <tbody>
            {factorsData.map((factor, index) => renderRow(factor, index))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const styles = {
  page: {
    backgroundColor: "#f8fafc",
    minHeight: "100vh",
    padding: "2rem",
    fontFamily: "Segoe UI, Arial, sans-serif",
    color: "#333",
  },
  title: {
    textAlign: "center",
    color: "#002b5c",
    fontSize: "1.8rem",
    fontWeight: "600",
    marginBottom: "0.5rem",
  },
  desc: {
    textAlign: "center",
    color: "#555",
    marginBottom: "2rem",
  },
  tableWrapper: {
    overflowX: "auto",
    maxWidth: "1200px",
    margin: "0 auto",
  },
  table: {
    borderCollapse: "collapse",
    width: "100%",
    backgroundColor: "white",
    boxShadow: "0 3px 10px rgba(0,0,0,0.1)",
  },
  header: {
    backgroundColor: "#003d6b",
    color: "white",
    padding: "0.8rem",
    textAlign: "center",
    fontWeight: "600",
    fontSize: "0.95rem",
    border: "1px solid #002d4f",
  },
  categoryRow: {
    backgroundColor: "#e8e8e8",
  },
  categoryCell: {
    padding: "0.6rem 1rem",
    textAlign: "left",
    fontWeight: "700",
    fontSize: "0.95rem",
    border: "1px solid #ccc",
  },
  descriptionCell: {
    padding: "0.6rem 1rem",
    textAlign: "left",
    fontSize: "0.9rem",
    border: "1px solid #ccc",
    fontStyle: "italic",
  },
  factorCell: {
    border: "1px solid #ccc",
    textAlign: "left",
    padding: "0.6rem 1rem",
    fontSize: "0.9rem",
    backgroundColor: "white",
  },
  noteCell: {
    border: "1px solid #ccc",
    textAlign: "center",
    padding: "0.4rem",
    fontSize: "0.85rem",
    fontStyle: "italic",
    color: "#555",
    backgroundColor: "white",
  },
  minorCell: {
    border: "1px solid #ccc",
    textAlign: "center",
    padding: "0.6rem",
    fontWeight: "500",
    fontSize: "0.9rem",
    backgroundColor: "#d4edda", // 淡绿色
  },
  moderateCell: {
    border: "1px solid #ccc",
    textAlign: "center",
    padding: "0.6rem",
    fontWeight: "500",
    fontSize: "0.9rem",
    backgroundColor: "#fff3cd", // 淡黄色
  },
  severeCell: {
    border: "1px solid #ccc",
    textAlign: "center",
    padding: "0.6rem",
    fontWeight: "500",
    fontSize: "0.9rem",
    backgroundColor: "#f8d7da", // 淡红色
  },
};

export default Factors;