import { SpacecraftPreview } from "./SpacecraftPreview";
export function SpacecraftGuide() {
  return (
    <details className="panel spacecraft-guide">
      <summary>
        Your spacecraft{" "}
        <span className="muted-note">Mass, power and steering</span>
      </summary>
      <SpacecraftPreview />
      <p>
        A classroom spacecraft inspired by IM-1 / Odysseus. These exercise
        parameters describe a generic vehicle; they are not verified flight
        specifications and do not drive the landing game.
      </p>
      <div className="spacecraft-table-wrap">
        <table>
          <caption>Parameters supplied in the classroom whiteboard</caption>
          <thead>
            <tr>
              <th>Quantity</th>
              <th>Exercise value</th>
              <th>What it means</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th>Dry mass</th>
              <td>1,500 kg (~3,307 lb)</td>
              <td>Spacecraft without propellant.</td>
            </tr>
            <tr>
              <th>Propellant</th>
              <td>2,400 kg (~5,291 lb)</td>
              <td>Full launch mass: 3,900 kg (~8,598 lb).</td>
            </tr>
            <tr>
              <th>Maximum thrust</th>
              <td>12 kN (~2,698 lbf)</td>
              <td>The same thrust accelerates a lighter vehicle more.</td>
            </tr>
            <tr>
              <th>Maximum mass flow</th>
              <td>3.88 kg/s (~8.55 lb/s)</td>
              <td>
                About 619 seconds of full-throttle burn, ignoring reserves.
              </td>
            </tr>
            <tr>
              <th>Specific impulse</th>
              <td>315 s</td>
              <td>A measure of propellant efficiency; not a force.</td>
            </tr>
            <tr>
              <th>Velocity-change budget</th>
              <td>About 2,950 m/s (~6,599 mph)</td>
              <td>
                An exercise budget, not the vehicle speed at every instant.
              </td>
            </tr>
            <tr>
              <th>Stored electrical energy</th>
              <td>4,500 Wh (4.5 kWh)</td>
              <td>Energy available to power equipment.</td>
            </tr>
            <tr>
              <th>Reaction wheel, idle</th>
              <td>15 W per wheel</td>
              <td>Three idle wheels use 45 W: up to 100 h for wheels alone.</td>
            </tr>
            <tr>
              <th>Reaction wheel, active</th>
              <td>180 W per wheel</td>
              <td>
                Three active wheels use 540 W: up to 8.3 h for wheels alone.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <h3>How does it turn?</h3>
      <p>
        Reaction wheels change the spacecraft orientation by changing their own
        spin. The exercise gives equal turning capabilities about Y and Z, and
        different values about X. A full tank changes the moment of inertia, so
        turning acceleration depends on the mass distribution as well as the
        applied torque.
      </p>
      <div className="spacecraft-table-wrap">
        <table>
          <caption>Turning acceleration in the classroom model</caption>
          <thead>
            <tr>
              <th>Axis</th>
              <th>Full tank (3,900 kg)</th>
              <th>Empty tank (1,500 kg)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th>Y and Z</th>
              <td>0.041 degrees/s²</td>
              <td>0.106 degrees/s²</td>
            </tr>
            <tr>
              <th>X</th>
              <td>0.191 degrees/s²</td>
              <td>0.496 degrees/s²</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p>
        Power is measured in W; energy in Wh. At 180 W, one wheel uses 0.05 Wh
        each second. Reaction wheels use electrical energy without ejecting
        propellant; thrusters consume propellant. The duration estimates above
        assume constant power, no recharging and no other loads.
      </p>
    </details>
  );
}
