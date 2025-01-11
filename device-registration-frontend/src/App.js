import React, { useState } from 'react';
import axios from 'axios';
import './App.css';

function App() {
  const [macAddress, setMacAddress] = useState('');
  const [commands, setCommands] = useState([]);
  const [selectedCommand, setSelectedCommand] = useState('');
  const [editIndex, setEditIndex] = useState(null);
  const [commandParameters, setCommandParameters] = useState({});
  const [flags, setFlags] = useState({
    antiPassback: false,
    deactivated: false,
    intermediaryGate: false,
  });

  const handleFlagChange = (event) => {
    const { name, checked } = event.target;
    setFlags({ ...flags, [name]: checked });
  };

  const handleParameterChange = (event) => {
    const { name, value, type, checked } = event.target;
    setCommandParameters({
      ...commandParameters,
      [name]: type === 'checkbox' ? checked : value,
    });
  };

  const addCommand = () => {
    if (selectedCommand) {
      const payload = { ...commandParameters };

      if (selectedCommand === 'SET_USER_METADATA') {
        payload.metadata =
          (flags.antiPassback ? 0x1 : 0) |
          (flags.deactivated ? 0x2 : 0) |
          (flags.intermediaryGate ? 0x4 : 0);
      }

      setCommands([...commands, { name: selectedCommand, payload }]);
      resetFields();
    }
  };

  const resetFields = () => {
    setSelectedCommand('');
    setCommandParameters({});
    setFlags({
      antiPassback: false,
      deactivated: false,
      intermediaryGate: false,
    });
    setEditIndex(null);
  };

  const editCommand = (index) => {
    setEditIndex(index);
    const command = commands[index];
    setSelectedCommand(command.name);
    setCommandParameters({ ...command.payload });

    if (command.name === 'SET_USER_METADATA') {
      setFlags({
        antiPassback: (command.payload.metadata & 0x1) !== 0,
        deactivated: (command.payload.metadata & 0x2) !== 0,
        intermediaryGate: (command.payload.metadata & 0x4) !== 0,
      });
    }
  };

  const saveEditedCommand = () => {
    if (editIndex !== null) {
      const updatedCommands = [...commands];
      const payload = { ...commandParameters };

      if (selectedCommand === 'SET_USER_METADATA') {
        payload.metadata =
          (flags.antiPassback ? 0x1 : 0) |
          (flags.deactivated ? 0x2 : 0) |
          (flags.intermediaryGate ? 0x4 : 0);
      }

      updatedCommands[editIndex] = { name: selectedCommand, payload };
      setCommands(updatedCommands);
      resetFields();
    }
  };

  const deleteCommand = (index) => {
    setCommands(commands.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    const data = getPayload();
  
    // Retrieve credentials from environment variables
    const username = process.env.ADMIN_USERNAME;
    const password = process.env.ADMIN_PASSWORD;
  
    // Encode the credentials for Basic Authentication
    const authHeader = `Basic ${btoa(`${username}:${password}`)}`;
  
    try {
      const response = await axios.post(
        `${process.env.BACKEND_BASE_URL}/commands/queue`,
        data,
        {
          headers: {
            Authorization: authHeader, // Set the Basic Auth header
          },
        }
      );
      console.log('Commands queued successfully:', response.data);
    } catch (error) {
      console.error('Error queuing commands:', error);
    }
  };

  const getPayload = () => ({
    macAddress,
    commands,
  });

  return (
    <div className="App">
      <h1>Set Commands for Device</h1>
      <div className="form-section">
        <label>MAC Address:</label>
        <input
          type="text"
          value={macAddress}
          onChange={(e) => setMacAddress(e.target.value)}
          placeholder="Device MAC Address"
        />
      </div>

      <div className="form-section">
        <h2>Commands</h2>
        <label>
          Select Command:
          <select value={selectedCommand} onChange={(e) => setSelectedCommand(e.target.value)}>
            <option value="">--Select Command--</option>
            <option value="SET_USER_METADATA">SET_USER_METADATA</option>
            <option value="SET_SUCCESS_BEEP">SET_SUCCESS_BEEP</option>
            <option value="SET_FAIL_BEEP">SET_FAIL_BEEP</option>
            <option value="SET_RELAY_MODE">SET_RELAY_MODE</option>
            <option value="SET_DHCP">SET_DHCP</option>
          </select>
        </label>

        {/* User Metadata Fields */}
        {selectedCommand === 'SET_USER_METADATA' && (
          <div>
            <h3>User Metadata</h3>
            <label>
              User ID:
              <input
                type="number"
                name="userId"
                value={commandParameters.userId || ''}
                onChange={handleParameterChange}
              />
            </label>
            <label>
              Card ID:
              <input
                type="number"
                name="cardId"
                value={commandParameters.cardId || ''}
                onChange={handleParameterChange}
              />
            </label>
            <h3>User Metadata Flags</h3>
            <label>
              <input
                type="checkbox"
                name="antiPassback"
                checked={flags.antiPassback}
                onChange={handleFlagChange}
              />
              Anti Passback
            </label>
            <label>
              <input
                type="checkbox"
                name="deactivated"
                checked={flags.deactivated}
                onChange={handleFlagChange}
              />
              Deactivated
            </label>
            <label>
              <input
                type="checkbox"
                name="intermediaryGate"
                checked={flags.intermediaryGate}
                onChange={handleFlagChange}
              />
              Intermediary Gate
            </label>
          </div>
        )}

        {/* Success/Fail Beep Parameters */}
        {(selectedCommand === 'SET_SUCCESS_BEEP' || selectedCommand === 'SET_FAIL_BEEP') && (
          <div>
            <label>
              Duration:
              <input
                type="number"
                name="duration"
                value={commandParameters.duration || ''}
                onChange={handleParameterChange}
              />
            </label>
            <label>
              Repeat:
              <input
                type="number"
                name="repeat"
                value={commandParameters.repeat || ''}
                onChange={handleParameterChange}
              />
            </label>
          </div>
        )}

        {/* Relay Mode Parameters */}
        {selectedCommand === 'SET_RELAY_MODE' && (
          <div>
            <label>
              Use Both Relays:
              <input
                type="checkbox"
                name="useBothRelays"
                checked={commandParameters.useBothRelays || false}
                onChange={handleParameterChange}
              />
            </label>
            <label>
              Relay 1 Default State:
              <input
                type="number"
                name="relay1DefaultState"
                value={commandParameters.relay1DefaultState || ''}
                onChange={handleParameterChange}
              />
            </label>
            <label>
              Relay 2 Default State:
              <input
                type="number"
                name="relay2DefaultState"
                value={commandParameters.relay2DefaultState || ''}
                onChange={handleParameterChange}
                disabled={!commandParameters.useBothRelays}
              />
            </label>
          </div>
        )}

        {/* DHCP Settings */}
        {selectedCommand === 'SET_DHCP' && (
          <div>
            <label>
              IP:
              <input
                type="text"
                name="ip"
                value={commandParameters.ip || ''}
                onChange={handleParameterChange}
              />
            </label>
            <label>
              Gateway:
              <input
                type="text"
                name="gateway"
                value={commandParameters.gateway || ''}
                onChange={handleParameterChange}
              />
            </label>
            <label>
              Subnet:
              <input
                type="text"
                name="subnet"
                value={commandParameters.subnet || ''}
                onChange={handleParameterChange}
              />
            </label>
            <label>
              DNS Server:
              <input
                type="text"
                name="dnsServer"
                value={commandParameters.dnsServer || ''}
                onChange={handleParameterChange}
              />
            </label>
          </div>
        )}

        <button onClick={editIndex !== null ? saveEditedCommand : addCommand}>
          {editIndex !== null ? 'Save Command' : 'Add Command'}
        </button>
      </div>

      <div className="form-section">
        <h2>Commands List</h2>
        <ul>
          {commands.map((command, index) => (
            <li key={index}>
              {command.name}: {JSON.stringify(command.payload)}
              <button onClick={() => editCommand(index)}>Edit</button>
              <button onClick={() => deleteCommand(index)}>Delete</button>
            </li>
          ))}
        </ul>
      </div>

      <div className="form-section">
        <h2>Payload Preview</h2>
        <pre className="payload-preview">{JSON.stringify(getPayload(), null, 2)}</pre>
      </div>

      <button className="submit-button" onClick={handleSubmit}>
        Queue Commands
      </button>
    </div>
  );
}

export default App;