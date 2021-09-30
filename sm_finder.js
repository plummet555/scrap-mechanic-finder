import sqlite3 from 'sqlite3';
import fs from 'fs';
import {
  access
} from 'fs/promises';

import {
  open
} from 'sqlite'
import {
  stringify as uuidStringify
} from 'uuid';

async function sm_finder() {
  var progArgs = process.argv.slice(2);
  if (progArgs.length != 2) {
    console.log("Scrap Mechanic parts finder");
    console.log("Run with: node sm_finder.js <save file db> <part UUID>");
    console.log("e.g.: node sm_finder.js mygame.db a736ffdf-22c1-40f2-8e40-988cab7c0559");
    console.log("Save files are found in: C:\\Users\\<user>\\AppData\\Roaming\\Axolot Games\\Scrap Mechanic\\User\\User_<id>\\Save\\Survival\\");
    console.log("Part UUIDs are found in: C:\\Program Files (x86)\\Steam\\steamapps\\common\\Scrap Mechanic\\Survival\\Scripts\\game\\survival_items.lua");
    return;
  }

  try {
    await sm_find(progArgs[0], progArgs[1]);
  } catch (e) {
    console.log("Error: " + e);
  }

  console.log("Finished");
}

async function sm_find(save_file, match_uuid) {
  try {
    await access(save_file, fs.constants.R_OK);
  } catch {
    console.log("Save file not found or not readable");
    return;
  }

  const db = await open({
    filename: save_file,
    driver: sqlite3.Database,
    mode: sqlite3.OPEN_READONLY
  });

  var rawSchemas = fs.readFileSync('sm_schemas.json');
  var schemas = JSON.parse(rawSchemas);

  var count = await db.all("SELECT count(id) FROM RigidBody");

  console.log("Total number of bodies in save file: " + count[0]['count(id)']);

  var found_bodies = [];

  const rowsCount = await db.each(
    'SELECT id,bodyId,data FROM ChildShape',
    (err, row) => {
      if (err) {
        throw err;
      }

      var bodyId = row.data.readIntBE(schemas.childShape.bodyId.start, schemas.childShape.bodyId.length);
      if (bodyId != row.bodyId) {
        console.log("Warning: body id mismatch");
      }

      var uuid_arr = Array.prototype.slice.call(row.data.slice(schemas.childShape.partUUID.start, schemas.childShape.partUUID.end));
      var uuid_str = uuidStringify(uuid_arr.reverse());

      if ((uuid_str == match_uuid) && (!found_bodies.includes(bodyId))) {
        console.log("Found creation with part. BodyId: " + bodyId);
        found_bodies.push(bodyId);
      }
    }
  )

  console.log(`Found ${found_bodies.length} matching bodies`);

  for (const body of found_bodies) {
    const rigidCount = await db.each(
      'SELECT id,data FROM RigidBody WHERE id = ?', body,
      (err, row) => {
        if (err) {
          throw err;
        }

        var match = {
          minX: Math.round(row.data.slice(schemas.rigidBody.minX.start, schemas.rigidBody.minX.end).readFloatBE()),
          maxX: Math.round(row.data.slice(schemas.rigidBody.maxX.start, schemas.rigidBody.maxX.end).readFloatBE()),
          minY: Math.round(row.data.slice(schemas.rigidBody.minY.start, schemas.rigidBody.minY.end).readFloatBE()),
          maxY: Math.round(row.data.slice(schemas.rigidBody.maxY.start, schemas.rigidBody.maxY.end).readFloatBE()),
          maxY: Math.round(row.data.slice(schemas.rigidBody.maxY.start, schemas.rigidBody.maxY.end).readFloatBE()),
          absZ: Math.round(row.data.slice(schemas.rigidBody.absZ.start, schemas.rigidBody.absZ.end).readFloatBE()),
        }

        console.log("Co-ordinates for body " + body + ":\n" + JSON.stringify(match));
      }
    )
  }

  return;
}

sm_finder();
