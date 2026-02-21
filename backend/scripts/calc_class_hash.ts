import { hash } from 'starknet';
import * as fs from 'fs';
import * as path from 'path';

const sierraPath = path.join(__dirname, '../../private_btc_core/target/dev/private_btc_core_MockBTC.contract_class.json');
const sierra = JSON.parse(fs.readFileSync(sierraPath, 'utf-8'));
const classHash = hash.computeContractClassHash(sierra);
console.log(classHash);
