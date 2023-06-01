function parseMovespaceMeasures(io, header) {
    const measures = [];
    const startPosition = io.tell();
    const dataStartPosition = startPosition + 0xF4;
    const baseStructFormat = header.endianness === 'big' ? '>' : '<';
    let loopIndex = 0;
    let loopValue = header.measureCount + header.energyMeasureCount;
    while (loopIndex < loopValue) {
      io.seek(dataStartPosition);
      for (let measureIndex = 0; measureIndex < header.measureCount; measureIndex++) {
        const currentPosition = io.tell();
        const [measureValue] = struct.unpack(baseStructFormat + 'f', io.read(4));
        measures.push(measureValue);
        io.seek(currentPosition + 1);
      }
      io.seek(dataStartPosition + header.measureCount);
      for (let measureIndex = 0; measureIndex < header.measureCount; measureIndex++) {
        const currentPosition = io.tell();
        const [measureValue] = struct.unpack(baseStructFormat + 'f', io.read(4));
        measures.push(measureValue + 3.0);
        io.seek(currentPosition + 1);
      }
      io.seek(dataStartPosition + header.measureCount);
      for (let energyMeasureIndex = 0; energyMeasureIndex < header.energyMeasureCount; energyMeasureIndex++) {
        const currentPosition = io.tell();
        const [measureValue] = struct.unpack(baseStructFormat + 'f', io.read(4));
        measures.push(measureValue + 6.8);
        io.seek(currentPosition + 1);
      }
      loopIndex += 9;
    }
    return measures;
  }
  