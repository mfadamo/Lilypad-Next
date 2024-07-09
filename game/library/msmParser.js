async function readInput(file) {
  const data = await file.arrayBuffer();
  const fileName = file.name.split('.')[0];
  const output = deserializemsm(data);
  downloadJSON(output, fileName + '.json');
}

function deserializemsm(arrayBuffer) {
  const dataView = new DataView(arrayBuffer);
  const msm = {};
  let offset = 4; // Skip the first 4 bytes

  // Read All Headers
  msm.version = dataView.getUint32(offset, false); offset += 4;
  msm.moveName = getString(dataView, offset, 0x40); offset += 0x40;
  msm.mapName = getString(dataView, offset, 0x40); offset += 0x40;
  msm.serializer = getString(dataView, offset, 0x40); offset += 0x40;
  msm.moveDuration = dataView.getFloat32(offset, false); offset += 4;
  msm.moveAccurateLowThreshold = dataView.getFloat32(offset, false); offset += 4;
  msm.moveAccurateHighThreshold = dataView.getFloat32(offset, false); offset += 4;

  if (msm.version === 7) {
      msm.autoCorrelationThreshold = dataView.getFloat32(offset, false); offset += 4;
      msm.moveDirectionImpactFactor = dataView.getFloat32(offset, false); offset += 4;
  }

  msm.moveMeasureBitfield = dataView.getBigUint64(offset, false); offset += 8;
  msm.measureValue = dataView.getUint32(offset, false); offset += 4;
  msm.measureCount = dataView.getUint32(offset, false); offset += 4;
  msm.energyMeasureCount = dataView.getUint32(offset, false); offset += 4;
  msm.moveCustomizationFlags = dataView.getUint32(offset, false); offset += 4;

  // Read Measure with x and y (calculated from measureCount * 2)
  const measures = parseMovespaceMeasures(new IO(dataView, offset), msm);
  msm.measures = measures.map((value, index, array) => {
      return index % 2 === 0 ? { data1: value, data2: array[index + 1] } : null;
  }).filter(measure => measure !== null);

  return msm;
}

function getString(dataView, offset, length) {
  let string = '';
  for (let i = offset; i < offset + length; i++) {
      const charCode = dataView.getUint8(i);
      if (charCode === 0) break; // Null terminator
      string += String.fromCharCode(charCode);
  }
  return string;
}

class IO {
  constructor(dataView, offset) {
      this.dataView = dataView;
      this.offset = offset;
  }

  tell() {
      return this.offset;
  }

  seek(newOffset) {
      this.offset = newOffset;
  }

  read(length) {
      const value = this.dataView.buffer.slice(this.offset, this.offset + length);
      this.offset += length;
      return value;
  }
}


///Credits: Synzr
function parseMovespaceMeasures(io, header) {
  const measures = [];
  const startPosition = io.tell();
  const dataStartPosition = startPosition + 0xF4;
  const isBigEndian = header.endianness === 'big';
  let loopIndex = 0;
  let loopValue = header.measureCount + header.energyMeasureCount;

  while (loopIndex < loopValue) {
      io.seek(dataStartPosition);

      for (let measureIndex = 0; measureIndex < header.measureCount; measureIndex++) {
          const currentPosition = io.tell();
          const measureValue = new DataView(io.read(4)).getFloat32(0, !isBigEndian);
          measures.push(measureValue);
          io.seek(currentPosition + 1);
      }

      io.seek(dataStartPosition + header.measureCount);

      for (let measureIndex = 0; measureIndex < header.measureCount; measureIndex++) {
          const currentPosition = io.tell();
          const measureValue = new DataView(io.read(4)).getFloat32(0, !isBigEndian);
          measures.push(measureValue + 3.0);
          io.seek(currentPosition + 1);
      }

      io.seek(dataStartPosition + header.measureCount);

      for (let energyMeasureIndex = 0; energyMeasureIndex < header.energyMeasureCount; energyMeasureIndex++) {
          const currentPosition = io.tell();
          const measureValue = new DataView(io.read(4)).getFloat32(0, !isBigEndian);
          measures.push(measureValue + 6.8);
          io.seek(currentPosition + 1);
      }

      loopIndex += 9;
  }

  return measures;
}

function downloadJSON(data, fileName) {
  const jsonStr = JSON.stringify(data, null, 4);
  const blob = new Blob([jsonStr], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
