import AppDataSource from '../src/data-source';

async function testEventFilter() {
  await AppDataSource.initialize();

  console.log('📊 Test Event Filter\n');

  // Test 1: All events
  const allEvents = await AppDataSource.query(`
    SELECT e.id, e."nChannelID", e.type, c.name as camera_name
    FROM events e
    LEFT JOIN cameras c ON c.id = e.camera_id
    ORDER BY e.created_at DESC
    LIMIT 5
  `);
  console.log('1️⃣ All Events (5 records):');
  console.table(allEvents);

  // Test 2: Filter by nChannelID = 2
  const channel2Events = await AppDataSource.query(`
    SELECT e.id, e."nChannelID", e.type, c.name as camera_name
    FROM events e
    LEFT JOIN cameras c ON c.id = e.camera_id
    WHERE e."nChannelID" = 2
    ORDER BY e.created_at DESC
  `);
  console.log('\n2️⃣ Events with nChannelID = 2:');
  console.table(channel2Events);

  // Test 3: Filter by nChannelID = 1
  const channel1Events = await AppDataSource.query(`
    SELECT e.id, e."nChannelID", e.type, c.name as camera_name
    FROM events e
    LEFT JOIN cameras c ON c.id = e.camera_id
    WHERE e."nChannelID" = 1
    ORDER BY e.created_at DESC
  `);
  console.log('\n3️⃣ Events with nChannelID = 1:');
  console.table(channel1Events);

  // Test 4: Count by channel
  const countByChannel = await AppDataSource.query(`
    SELECT "nChannelID", COUNT(*) as count
    FROM events
    GROUP BY "nChannelID"
    ORDER BY "nChannelID"
  `);
  console.log('\n4️⃣ Event count by channel:');
  console.table(countByChannel);

  await AppDataSource.destroy();
}

testEventFilter().catch(console.error);
