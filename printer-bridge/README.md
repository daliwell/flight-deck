# Flight Deck Printer Bridge

Local bridge application that enables the Flight Deck web app to print to Brother QL-820NWB via classic Bluetooth.

## Why is this needed?

The Brother QL-820NWB uses classic Bluetooth (SPP), which is not accessible via the Web Bluetooth API. This bridge runs locally on your Mac/PC and provides an HTTP endpoint that the web app can communicate with.

## Setup

### 1. Install Dependencies

```bash
cd printer-bridge
npm install
```

### 2. Pair Your Printer

1. Open **System Settings** > **Bluetooth**
2. Put your Brother QL-820NWB in pairing mode (hold Bluetooth button)
3. Click **Connect** when it appears (e.g., "QL-820NWB8723")
4. Wait for "Connected" status

### 3. Start the Bridge

```bash
npm start
```

You should see:
```
╔════════════════════════════════════════════════╗
║   Flight Deck Printer Bridge                   ║
╚════════════════════════════════════════════════╝

✓ Bridge running on http://localhost:8765
```

### 4. Use in Web App

1. Open Flight Deck in your browser
2. Click the **Printer** button
3. Select **Use Local Bridge** (new option)
4. Choose your printer from the list
5. Print badges!

## API Endpoints

- `GET /health` - Check if bridge is running
- `GET /printers` - List available Bluetooth printers
- `POST /connect` - Connect to a specific printer
- `POST /disconnect` - Disconnect from printer
- `POST /print` - Send a print job

## Troubleshooting

### Printer not showing in list

1. Make sure printer is paired in System Settings > Bluetooth
2. Check printer is connected (blue light solid)
3. Look for a serial port path like `/dev/tty.QL-820NWB8723-SerialPort`

### Print job not working

The ESC/P commands in `server.js` may need adjustment for your specific label size. Brother QL-820NWB supports multiple tape widths (29mm, 38mm, 50mm, 62mm, 102mm).

Check Brother's developer documentation for the exact command sequences for your tape width.

### Connection errors

- Try restarting the bridge
- Re-pair the printer in Bluetooth settings
- Check printer battery/power

## Development

Run with auto-reload:

```bash
npm run dev
```

## Platform Support

- ✅ macOS (tested)
- ✅ Windows (should work with Bluetooth SPP)
- ❌ Linux (requires bluez setup)

## Port

The bridge runs on port **8765** by default. If this conflicts with another service, edit `PORT` in `server.js`.
