(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.DAPjs = f()}})(function(){var define,module,exports;return (function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_RUNCODE_TIMEOUT = 10000 /* ms */;
exports.CPUID_IMPLEMENTER_MASK = 0xff000000;
exports.CPUID_IMPLEMENTER_POS = 24;
exports.CPUID_VARIANT_MASK = 0x00f00000;
exports.CPUID_VARIANT_POS = 20;
exports.CPUID_ARCHITECTURE_MASK = 0x000f0000;
exports.CPUID_ARCHITECTURE_POS = 16;
exports.CPUID_PARTNO_MASK = 0x0000fff0;
exports.CPUID_PARTNO_POS = 4;
exports.CPUID_REVISION_MASK = 0x0000000f;
exports.CPUID_REVISION_POS = 0;
exports.ISANames = new Map();
exports.ISANames.set(12 /* ARMv6M */, "ARMv6M");
exports.ISANames.set(15 /* ARMv7M */, "ARMv7M");
exports.CoreNames = new Map();
exports.CoreNames.set(3104 /* CortexM0 */, "Cortex-M0");
exports.CoreNames.set(3105 /* CortexM1 */, "Cortex-M1");
exports.CoreNames.set(3107 /* CortexM3 */, "Cortex-M3");
exports.CoreNames.set(3108 /* CortexM4 */, "Cortex-M4");
exports.CoreNames.set(3168 /* CortexM0p */, "Cortex-M0+");



},{}],2:[function(require,module,exports){
"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const debug_1 = require("../debug/debug");
const memory_1 = require("../memory/memory");
const prepared_1 = require("../memory/prepared");
const util_1 = require("../util");
const constants_1 = require("./constants");
const prepared_2 = require("./prepared");
/**
 * # Cortex M
 *
 * Manages access to a CPU core, and its associated memory and debug functionality.
 *
 * > **NOTE:** all of the methods that involve interaction with the CPU core
 * > are asynchronous, so must be `await`ed, or explicitly handled as a Promise.
 *
 * ## Usage
 *
 * First, let's create an instance of `CortexM`, using an associated _Debug Access
 * Port_ (DAP) instance that we created earlier.
 *
 * ```typescript
 * const core = new CortexM(dap);
 * ```
 *
 * Now, we can halt and resume the core just like this:
 *
 * > **NOTE:** If you're not using ES2017, you can replace the use of `async` and
 * > `await` with direct use of Promises. These examples also need to be run within
 * > an `async` function for `async` to be used.
 *
 * ```typescript
 * await core.halt();
 * await core.resume();
 * ```
 *
 * Resetting the core is just as easy:
 *
 * ```typescript
 * await core.reset();
 * ```
 *
 * You can even halt immediately after reset:
 *
 * ```typescript
 * await core.reset(true);
 * ```
 *
 * We can also read and write 32-bit values to/from core registers:
 *
 * ```typescript
 * const sp = await core.readCoreRegister(CortexReg.SP);
 *
 * await core.writeCoreRegister(CortexReg.R0, 0x1000);
 * await core.writeCoreRegister(CortexReg.PC, 0x1234);
 * ```
 *
 * ### See also
 *
 * For details on debugging and memory features, see the documentation for
 * `Debug` and `Memory`.
 */
class CortexM {
    constructor(device) {
        this.dev = device;
        this.memory = new memory_1.Memory(device);
        this.debug = new debug_1.Debug(this);
    }
    /**
     * Initialise the debug access port on the device, and read the device type.
     */
    init() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.dev.init();
            // FIXME: don't run this if security is enabled on the K64F
            yield this.debug.init();
            yield this.readCoreType();
        });
    }
    /**
     * Read the current state of the CPU.
     *
     * @returns A member of the `CoreState` enum corresponding to the current status of the CPU.
     */
    getState() {
        return __awaiter(this, void 0, void 0, function* () {
            const dhcsr = yield this.memory.read32(3758157296 /* DHCSR */);
            if (dhcsr & 33554432 /* S_RESET_ST */) {
                const newDHCSR = yield this.memory.read32(3758157296 /* DHCSR */);
                if (newDHCSR & 33554432 /* S_RESET_ST */ && !(newDHCSR & 16777216 /* S_RETIRE_ST */)) {
                    return 0 /* TARGET_RESET */;
                }
            }
            if (dhcsr & 524288 /* S_LOCKUP */) {
                return 1 /* TARGET_LOCKUP */;
            }
            else if (dhcsr & 262144 /* S_SLEEP */) {
                return 2 /* TARGET_SLEEPING */;
            }
            else if (dhcsr & 131072 /* S_HALT */) {
                return 3 /* TARGET_HALTED */;
            }
            else {
                return 4 /* TARGET_RUNNING */;
            }
        });
    }
    /**
     * Read the CPUID register from the CPU, and interpret its meaning in terms of implementer,
     * architecture and core type.
     */
    readCoreType() {
        return __awaiter(this, void 0, void 0, function* () {
            const cpuid = yield this.memory.read32(3758157056 /* CPUID */);
            const implementer = ((cpuid & constants_1.CPUID_IMPLEMENTER_MASK) >> constants_1.CPUID_IMPLEMENTER_POS);
            const arch = ((cpuid & constants_1.CPUID_ARCHITECTURE_MASK) >> constants_1.CPUID_ARCHITECTURE_POS);
            const coreType = ((cpuid & constants_1.CPUID_PARTNO_MASK) >> constants_1.CPUID_PARTNO_POS);
            return [implementer, arch, coreType];
        });
    }
    prepareCommand() {
        return new prepared_2.PreparedCortexMCommand(this.dev);
    }
    /**
     * Read a core register from the CPU (e.g. r0...r15, pc, sp, lr, s0...)
     *
     * @param no Member of the `CortexReg` enum - an ARM Cortex CPU general-purpose register.
     */
    readCoreRegister(no) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.memory.write32(3758157300 /* DCRSR */, no);
            const v = yield this.memory.read32(3758157296 /* DHCSR */);
            util_1.assert(v & 65536 /* S_REGRDY */);
            return yield this.memory.read32(3758157304 /* DCRDR */);
        });
    }
    /**
     * Write a 32-bit word to the specified CPU general-purpose register.
     *
     * @param no Member of the `CortexReg` enum - an ARM Cortex CPU general-purpose register.
     * @param val Value to be written.
     */
    writeCoreRegister(no, val) {
        return __awaiter(this, void 0, void 0, function* () {
            const prep = new prepared_1.PreparedMemoryCommand(this.dev);
            prep.write32(3758157304 /* DCRDR */, val);
            prep.write32(3758157300 /* DCRSR */, no | 65536 /* DCRSR_REGWnR */);
            prep.read32(3758157296 /* DHCSR */);
            const v = (yield prep.go())[0];
            util_1.assert(v & 65536 /* S_REGRDY */);
        });
    }
    /**
     * Halt the CPU core.
     */
    halt() {
        return __awaiter(this, void 0, void 0, function* () {
            return this.memory.write32(3758157296 /* DHCSR */, -1604386816 /* DBGKEY */ | 1 /* C_DEBUGEN */ | 2 /* C_HALT */);
        });
    }
    /**
     * Resume the CPU core.
     */
    resume() {
        return __awaiter(this, void 0, void 0, function* () {
            if (yield this.isHalted()) {
                yield this.memory.write32(3758157104 /* DFSR */, 4 /* DFSR_DWTTRAP */ | 2 /* DFSR_BKPT */ | 1 /* DFSR_HALTED */);
                yield this.debug.enable();
            }
        });
    }
    /**
     * Find out whether the CPU is halted.
     */
    isHalted() {
        return __awaiter(this, void 0, void 0, function* () {
            const s = yield this.status();
            return s.isHalted;
        });
    }
    /**
     * Read the current status of the CPU.
     *
     * @returns Object containing the contents of the `DHCSR` register, the `DFSR` register, and a boolean value
     * stating the current halted state of the CPU.
     */
    status() {
        return __awaiter(this, void 0, void 0, function* () {
            const prep = new prepared_1.PreparedMemoryCommand(this.dev);
            prep.read32(3758157296 /* DHCSR */);
            prep.read32(3758157104 /* DFSR */);
            const results = yield prep.go();
            const dhcsr = results[0];
            const dfsr = results[1];
            return {
                dfsr,
                dhscr: dhcsr,
                isHalted: !!(dhcsr & 131072 /* S_HALT */),
            };
        });
    }
    /**
     * Reset the CPU core. This currently does a software reset - it is also technically possible to perform a 'hard'
     * reset using the reset pin from the debugger.
     */
    reset(halt = false) {
        return __awaiter(this, void 0, void 0, function* () {
            if (halt) {
                yield this.halt();
                // VC_CORERESET causes the core to halt on reset.
                const demcr = yield this.memory.read32(3758157308 /* DEMCR */);
                yield this.memory.write32(3758157308 /* DEMCR */, demcr | 1 /* DEMCR_VC_CORERESET */);
                yield this.softwareReset();
                yield this.waitForHalt();
                // Unset the VC_CORERESET bit
                yield this.memory.write32(3758157308 /* DEMCR */, demcr);
            }
            else {
                yield this.softwareReset();
            }
        });
    }
    /**
     * Run specified machine code natively on the device. Assumes usual C calling conventions
     * - returns the value of r0 once the program has terminated. The program _must_ terminate
     * in order for this function to return. This can be achieved by placing a `bkpt`
     * instruction at the end of the function.
     *
     * @param code array containing the machine code (32-bit words).
     * @param address memory address at which to place the code.
     * @param pc initial value of the program counter.
     * @param lr initial value of the link register.
     * @param sp initial value of the stack pointer.
     * @param upload should we upload the code before running it.
     * @param args set registers r0...rn before running code
     *
     * @returns A promise for the value of r0 on completion of the function call.
     */
    runCode(code, address, pc, lr, sp, upload, ...args) {
        return __awaiter(this, void 0, void 0, function* () {
            // await this.halt();
            const cmd = this.prepareCommand();
            cmd.halt();
            // Point the program counter to the start of the program
            cmd.writeCoreRegister(15 /* PC */, pc);
            cmd.writeCoreRegister(14 /* LR */, lr);
            cmd.writeCoreRegister(13 /* SP */, sp);
            for (let i = 0; i < args.length; i++) {
                cmd.writeCoreRegister(i, args[i]);
            }
            yield cmd.go();
            // Write the program to memory at the specified address
            if (upload) {
                yield this.memory.writeBlock(address, code);
            }
            // Run the program and wait for halt
            yield this.resume();
            yield this.waitForHalt(constants_1.DEFAULT_RUNCODE_TIMEOUT); // timeout after 10s
            return yield this.readCoreRegister(0 /* R0 */);
        });
    }
    /**
     * Spin until the chip has halted.
     */
    waitForHalt(timeout = 0) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
                let running = true;
                if (timeout > 0) {
                    setTimeout(() => {
                        reject("waitForHalt timed out.");
                        running = false;
                    }, timeout);
                }
                while (running && !(yield this.isHalted())) {
                    /* empty */
                }
                if (running) {
                    resolve();
                }
            }));
        });
    }
    softwareReset() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.memory.write32(3758157068 /* NVIC_AIRCR */, 100270080 /* NVIC_AIRCR_VECTKEY */ | 4 /* NVIC_AIRCR_SYSRESETREQ */);
            // wait for the system to come out of reset
            let dhcsr = yield this.memory.read32(3758157296 /* DHCSR */);
            while ((dhcsr & 33554432 /* S_RESET_ST */) !== 0) {
                dhcsr = yield this.memory.read32(3758157296 /* DHCSR */);
            }
        });
    }
}
exports.CortexM = CortexM;



},{"../debug/debug":7,"../memory/memory":8,"../memory/prepared":9,"../util":17,"./constants":1,"./prepared":3}],3:[function(require,module,exports){
"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const prepared_1 = require("../memory/prepared");
/**
 * # Cortex M: Prepared Command
 *
 * Allows batching of Cortex M-related commands, such as writing to a register,
 * halting and resuming the core.
 *
 * ## Example
 *
 * When preparing the sequence of commands, we can use the same API to prepare
 * a command as we would to execute them immediately.
 *
 * ```typescript
 * // Note that only the .go method is asynchronous.
 *
 * const prep = core.prepareCommand();
 * prep.writeCoreRegister(CortexReg.R0, 0x1000);
 * prep.writeCoreRegister(CortexReg.R1, 0x0);
 * prep.writeCoreRegister(CortexReg.PC, 0x2000000);
 * prep.resume();
 * ```
 *
 * We can then execute them as efficiently as possible by combining them together
 * and executing them like so.
 *
 * ```typescript
 * await prep.go();
 * ```
 *
 * The code above is equivalent to the following _non-prepared_ command:
 *
 * ```typescript
 * await core.writeCoreRegister(CortexReg.R0, 0x1000);
 * await core.writeCoreRegister(CortexReg.R1, 0x0);
 * await core.writeCoreRegister(CortexReg.PC, 0x2000000);
 * await core.resume();
 * ```
 *
 * Since the batched version of this code avoids making three round-trips to the
 * target, we are able to significantly improve performance. This is especially
 * noticable when uploading a binary to flash memory, where are large number of
 * repetetive commands are being used.
 *
 * ## Explanation
 *
 * For a detailed explanation of why prepared commands are used in DAP.js, see the
 * documentation for `PreparedDapCommand`.
 */
class PreparedCortexMCommand {
    constructor(dap) {
        this.cmd = new prepared_1.PreparedMemoryCommand(dap);
    }
    /**
     * Schedule a 32-bit integer to be written to a core register.
     *
     * @param no Core register to be written.
     * @param val Value to write.
     */
    writeCoreRegister(no, val) {
        this.cmd.write32(3758157304 /* DCRDR */, val);
        this.cmd.write32(3758157300 /* DCRSR */, no | 65536 /* DCRSR_REGWnR */);
    }
    /**
     * Schedule a halt command to be written to the CPU.
     */
    halt() {
        this.cmd.write32(3758157296 /* DHCSR */, -1604386816 /* DBGKEY */ | 1 /* C_DEBUGEN */ | 2 /* C_HALT */);
    }
    /**
     * Schedule a resume command to be written to the CPU.
     */
    resume() {
        this.cmd.write32(3758157104 /* DFSR */, 4 /* DFSR_DWTTRAP */ | 2 /* DFSR_BKPT */ | 1 /* DFSR_HALTED */);
    }
    /**
     * Execute all scheduled commands.
     */
    go() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.cmd.go();
        });
    }
}
exports.PreparedCortexMCommand = PreparedCortexMCommand;



},{"../memory/prepared":9}],4:[function(require,module,exports){
"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const prepared_1 = require("./prepared");
const cmsis_dap_1 = require("../transport/cmsis_dap");
const util_1 = require("../util");
class DAP {
    // private idcode: number;
    constructor(device) {
        this.device = device;
        this.dap = new cmsis_dap_1.CMSISDAP(device);
    }
    reconnect() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.dap.disconnect();
            yield util_1.delay(100);
            yield this.init();
        });
    }
    init() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.dap.connect();
            yield this.readDp(0 /* IDCODE */);
            // const n = await this.readDp(Reg.IDCODE);
            // this.idcode = n;
            let prep = this.prepareCommand();
            prep.writeReg(0 /* DP_0x0 */, 1 << 2); // clear sticky error
            prep.writeDp(2 /* SELECT */, 0);
            prep.writeDp(1 /* CTRL_STAT */, 1073741824 /* CSYSPWRUPREQ */ | 268435456 /* CDBGPWRUPREQ */);
            const m = 536870912 /* CDBGPWRUPACK */ | 2147483648 /* CSYSPWRUPACK */;
            prep.readDp(1 /* CTRL_STAT */);
            let v = (yield prep.go())[0];
            while ((v & m) !== m) {
                v = yield this.readDp(1 /* CTRL_STAT */);
            }
            prep = this.prepareCommand();
            prep.writeDp(1 /* CTRL_STAT */, (1073741824 /* CSYSPWRUPREQ */ |
                268435456 /* CDBGPWRUPREQ */ |
                0 /* TRNNORMAL */ |
                3840 /* MASKLANE */));
            prep.writeDp(2 /* SELECT */, 0);
            prep.readAp(252 /* IDR */);
            yield prep.go();
        });
    }
    writeReg(regId, val) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.regOp(regId, val);
        });
    }
    readReg(regId) {
        return __awaiter(this, void 0, void 0, function* () {
            const buf = yield this.regOp(regId, null);
            const v = util_1.readUInt32LE(buf, 3);
            return v;
        });
    }
    prepareCommand() {
        return new prepared_1.PreparedDapCommand(this.dap);
    }
    readDp(addr) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.readReg(addr);
        });
    }
    readAp(addr) {
        return __awaiter(this, void 0, void 0, function* () {
            const prep = this.prepareCommand();
            prep.writeDp(2 /* SELECT */, util_1.bank(addr));
            prep.readReg(util_1.apReg(addr, 2 /* READ */));
            return (yield prep.go())[0];
        });
    }
    writeDp(addr, data) {
        if (addr === 2 /* SELECT */) {
            if (data === this.dpSelect) {
                return Promise.resolve();
            }
            this.dpSelect = data;
        }
        return this.writeReg(addr, data);
    }
    writeAp(addr, data) {
        return __awaiter(this, void 0, void 0, function* () {
            if (addr === 0 /* CSW */) {
                if (data === this.csw) {
                    return Promise.resolve();
                }
                this.csw = data;
            }
            const prep = this.prepareCommand();
            prep.writeDp(2 /* SELECT */, util_1.bank(addr));
            prep.writeReg(util_1.apReg(addr, 0 /* WRITE */), data);
            yield prep.go();
        });
    }
    close() {
        return __awaiter(this, void 0, void 0, function* () {
            return this.device.close();
        });
    }
    readRegRepeat(regId, cnt) {
        return __awaiter(this, void 0, void 0, function* () {
            util_1.assert(cnt <= 15);
            const request = util_1.regRequest(regId);
            const sendargs = [0, cnt];
            for (let i = 0; i < cnt; ++i) {
                sendargs.push(request);
            }
            const buf = yield this.dap.cmdNums(5 /* DAP_TRANSFER */, sendargs);
            if (buf[1] !== cnt) {
                throw new Error(("(many) Bad #trans " + buf[1]));
            }
            else if (buf[2] !== 1) {
                throw new Error(("(many) Bad transfer status " + buf[2]));
            }
            return buf.subarray(3, 3 + cnt * 4);
        });
    }
    writeRegRepeat(regId, data) {
        return __awaiter(this, void 0, void 0, function* () {
            const remainingLength = 64 - 1 - 1 - 2 - 1; // 14
            util_1.assert(data.length <= remainingLength / 4);
            /*
                BYTE | BYTE *****| SHORT**********| BYTE *************| WORD *********|
              > 0x06 | DAP Index | Transfer Count | Transfer Request  | Transfer Data |
                     |***********|****************|*******************|+++++++++++++++|
            */
            const request = util_1.regRequest(regId, true);
            const sendargs = [0, data.length, 0, request];
            data.forEach(d => {
                // separate d into bytes
                util_1.addInt32(sendargs, d);
            });
            const buf = yield this.dap.cmdNums(6 /* DAP_TRANSFER_BLOCK */, sendargs);
            if (buf[3] !== 1) {
                throw new Error(("(many-wr) Bad transfer status " + buf[2]));
            }
        });
    }
    regOp(regId, val) {
        return __awaiter(this, void 0, void 0, function* () {
            const request = util_1.regRequest(regId, val !== null);
            const sendargs = [0, 1, request];
            if (val !== null) {
                util_1.addInt32(sendargs, val);
            }
            const buf = yield this.dap.cmdNums(5 /* DAP_TRANSFER */, sendargs);
            if (buf[1] !== 1) {
                throw new Error(("Bad #trans " + buf[1]));
            }
            else if (buf[2] !== 1) {
                if (buf[2] === 2) {
                    throw new Error(("Transfer wait"));
                }
                throw new Error(("Bad transfer status " + buf[2]));
            }
            return buf;
        });
    }
}
exports.DAP = DAP;



},{"../transport/cmsis_dap":15,"../util":17,"./prepared":5}],5:[function(require,module,exports){
"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const util_1 = require("../util");
/**
 * # Prepared DAP Command
 *
 * Batches together multiple Debug Access Port (DAP) commands into one (or more)
 * CMSIS-DAP Transfers that can be written together to improve link utilisation.
 *
 * > **NOTE:** this will not normally need to be used by applications or libraries
 * > depending on DAP.js.
 *
 * ## Architecture
 *
 * - `PreparedDapCommand` keeps a list of CMSIS-DAP `Transfer` commands.
 * - Every time an action is scheduled (writing to or reading from a DP or AP register),
 * we check to see if there is any remaining room in the current batch, starting a new
 * batch if none is available.
 * - When `go` is called, the batches are executed sequentially (so DAP commands are
 * executed in the order they were added).
 *
 * ### Reading Values
 *
 * Writing values to registers is relatively straight forward, however mixing register
 * reads and writes together requires us to keep track of how many commands in
 * each batch are read commands.
 *
 * Once data has successfully been read back from the target, the values read are assembled
 * into an array, and returned in the order they requested. This allows `PreparedDapCommand`s
 * to be used higher up the stack in places where multiple independent read operations take
 * place sequentially.
 *
 * ### Constructing CMSIS-DAP Commands
 *
 * We keep track of the number of commands in each batch, so that we can fill in the command
 * count field of the `DAP_Transfer`.
 */
class PreparedDapCommand {
    constructor(dap) {
        this.dap = dap;
        this.commands = [[0, 1]];
        this.commandCounts = [0];
        this.currentCommand = 0;
        this.readCounts = [0];
    }
    /**
     * Schedule a value to be written to an AP or DP register.
     *
     * @param regId register ID to be written to
     * @param value value to be written
     */
    writeReg(regId, value) {
        const request = util_1.regRequest(regId, true);
        if (this.commands[this.currentCommand].length + 5 > 64) {
            // start a new command
            this.commands.push([0, 1]);
            this.commandCounts.push(0);
            this.readCounts.push(0);
            this.currentCommand++;
        }
        this.commands[this.currentCommand].push(request);
        util_1.addInt32(this.commands[this.currentCommand], value);
        this.commandCounts[this.currentCommand]++;
    }
    /**
     * Schedule a value to be read from an AP or DP register.
     * @param regId register to read from
     */
    readReg(regId) {
        const request = util_1.regRequest(regId, false);
        if (this.commands[this.currentCommand].length + 1 > 64) {
            // start a new command
            this.commands.push([0, 1]);
            this.commandCounts.push(0);
            this.readCounts.push(0);
            this.currentCommand++;
        }
        this.commands[this.currentCommand].push(request);
        this.commandCounts[this.currentCommand]++;
        this.readCounts[this.currentCommand]++;
    }
    /**
     * Schedule multiple values to be written to the same register.
     *
     * **TODO:** figure out dynamically whether it's better to use DAP_TransferBlock vs
     * DAP_Transfer. We should be able to fill up the remaining space in a Transfer
     * and then start a TransferBlock _if_ we can fit in _13 or more_ values into the
     * TransferBlock. However, the gains from this are marginal unless we're using much
     * larger packet sizes than 64 bytes.
     *
     * @param regId register to write to repeatedly
     * @param data array of 32-bit values to be written
     */
    writeRegRepeat(regId, data) {
        // fill up the rest of the command we have left
        data.forEach(cmd => {
            this.writeReg(regId, cmd);
        });
    }
    /**
     * Asynchronously execute the commands scheduled.
     */
    go() {
        return __awaiter(this, void 0, void 0, function* () {
            const v = [];
            for (let i = 0; i < this.commands.length; i++) {
                const command = this.commands[i];
                command[1] = this.commandCounts[i];
                const result = yield this.dap.cmdNums(5 /* DAP_TRANSFER */, command);
                for (let j = 0; j < this.readCounts[i]; j++) {
                    v.push(util_1.readUInt32LE(result, 3 + 4 * j));
                }
            }
            return v;
        });
    }
    /**
     * Schedule a value to be written to a DP register
     *
     * @param addr Address to write to
     * @param data Data to be written
     */
    writeDp(addr, data) {
        if (addr === 2 /* SELECT */) {
            if (data === this.dpSelect) {
                return Promise.resolve();
            }
            this.dpSelect = data;
        }
        return this.writeReg(addr, data);
    }
    /**
     * Schedule a value to be written to an AP register
     *
     * @param addr Address to write to
     * @param data Data to be written
     */
    writeAp(addr, data) {
        this.writeDp(2 /* SELECT */, util_1.bank(addr));
        if (addr === 0 /* CSW */) {
            if (data === this.csw) {
                return Promise.resolve();
            }
            this.csw = data;
        }
        this.writeReg(util_1.apReg(addr, 0 /* WRITE */), data);
    }
    /**
     * Schedule a DP register to read from
     *
     * @param addr Address to read from
     */
    readDp(addr) {
        return this.readReg(addr);
    }
    /**
     * Schedule an AP register to read from
     *
     * @param addr Address to read from
     */
    readAp(addr) {
        this.writeDp(2 /* SELECT */, util_1.bank(addr));
        return this.readReg(util_1.apReg(addr, 2 /* READ */));
    }
}
exports.PreparedDapCommand = PreparedDapCommand;



},{"../util":17}],6:[function(require,module,exports){
"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
class HWBreakpoint {
    constructor(regAddr, parent, addr) {
        this.regAddr = regAddr;
        this.parent = parent;
        this.addr = addr;
    }
    set() {
        return __awaiter(this, void 0, void 0, function* () {
            /* set hardware breakpoint */
            const bpMatch = ((this.addr & 0x2) ? 2 : 1) << 30;
            yield this.parent.memory.write32(this.regAddr, this.addr & 0x1ffffffc | bpMatch | 1);
        });
    }
    clear() {
        return __awaiter(this, void 0, void 0, function* () {
            /* clear hardware breakpoint */
            yield this.parent.memory.write32(this.regAddr, 0);
        });
    }
}
exports.HWBreakpoint = HWBreakpoint;
class SWBreakpoint {
    constructor(parent, addr) {
        this.parent = parent;
        this.addr = addr;
    }
    set() {
        return __awaiter(this, void 0, void 0, function* () {
            // read the instruction from the CPU...
            this.instruction = yield this.parent.memory.read16(this.addr);
            yield this.parent.memory.write16(this.addr, SWBreakpoint.BKPT_INSTRUCTION);
        });
    }
    clear() {
        return __awaiter(this, void 0, void 0, function* () {
            /* clear hardware breakpoint */
            yield this.parent.memory.write16(this.addr, this.instruction);
        });
    }
}
SWBreakpoint.BKPT_INSTRUCTION = 0xbe00;
exports.SWBreakpoint = SWBreakpoint;



},{}],7:[function(require,module,exports){
"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const breakpoint_1 = require("./breakpoint");
/**
 * # Debug Interface
 *
 * Keeps track of breakpoints set on the target, as well as deciding whether to
 * use a hardware breakpoint or a software breakpoint.
 *
 * ## Usage
 *
 * ```typescript
 * const dbg = core.debug;
 *
 * await dbg.setBreakpoint(0x123456);
 *
 * // resume the core and wait for the breakpoint
 * await core.resume();
 * await core.waitForHalt();
 *
 * // step forward one instruction
 * await dbg.step();
 *
 * // remove the breakpoint
 * await dbg.deleteBreakpoint(0x123456);
 * ```
 */
class Debug {
    constructor(core) {
        this.core = core;
        this.enabled = false;
        this.availableHWBreakpoints = [];
        this.breakpoints = new Map();
    }
    init() {
        return __awaiter(this, void 0, void 0, function* () {
            return this.setupFpb();
        });
    }
    /**
     * Enable debugging on the target CPU
     */
    enable() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.core.memory.write32(3758157296 /* DHCSR */, -1604386816 /* DBGKEY */ | 1 /* C_DEBUGEN */);
        });
    }
    /**
     * Set breakpoints at specified memory addresses.
     *
     * @param addrs An array of memory addresses at which to set breakpoints.
     */
    setBreakpoint(addr) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.breakpoints.has(addr)) {
                // we already have a breakpoint there.
                const breakpoint = this.breakpoints.get(addr);
                if (typeof breakpoint !== "number") {
                    // already enabled
                    // tslint:disable-next-line:no-console
                    console.warn(`Breakpoint at ${addr.toString(16)} already enabled.`);
                    return;
                }
            }
            let bkpt;
            // choose where best to place a breakpoint
            if (addr < 0x20000000) {
                // we can use a HWBreakpoint
                if (this.availableHWBreakpoints.length > 0) {
                    if (!this.enabled) {
                        yield this.setFpbEnabled(true);
                    }
                    const regAddr = this.availableHWBreakpoints.pop();
                    bkpt = new breakpoint_1.HWBreakpoint(regAddr, this.core, addr);
                }
                else {
                    bkpt = new breakpoint_1.SWBreakpoint(this.core, addr);
                }
            }
            else {
                bkpt = new breakpoint_1.SWBreakpoint(this.core, addr);
            }
            yield bkpt.set();
            this.breakpoints.set(addr, bkpt);
        });
    }
    deleteBreakpoint(addr) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.breakpoints.has(addr)) {
                const bkpt = this.breakpoints.get(addr);
                if (typeof bkpt !== "number") {
                    yield bkpt.clear();
                    if (bkpt instanceof breakpoint_1.HWBreakpoint) {
                        // return the register address to the pool
                        this.availableHWBreakpoints.push(bkpt.regAddr);
                    }
                }
                this.breakpoints.delete(addr);
            }
            else {
                // tslint:disable-next-line:no-console
                console.warn(`Breakpoint at ${addr.toString(16)} does not exist.`);
            }
        });
    }
    /**
     * Step the processor forward by one instruction.
     */
    step() {
        return __awaiter(this, void 0, void 0, function* () {
            const dhcsr = yield this.core.memory.read32(3758157296 /* DHCSR */);
            if (!(dhcsr & (4 /* C_STEP */ | 2 /* C_HALT */))) {
                // tslint:disable-next-line:no-console
                console.error("Target is not halted.");
                return;
            }
            const interruptsMasked = (8 /* C_MASKINTS */ & dhcsr) !== 0;
            if (!interruptsMasked) {
                yield this.core.memory.write32(3758157296 /* DHCSR */, -1604386816 /* DBGKEY */ |
                    1 /* C_DEBUGEN */ |
                    2 /* C_HALT */ |
                    8 /* C_MASKINTS */);
            }
            yield this.core.memory.write32(3758157296 /* DHCSR */, -1604386816 /* DBGKEY */ |
                1 /* C_DEBUGEN */ |
                8 /* C_MASKINTS */ |
                4 /* C_STEP */);
            yield this.core.waitForHalt();
            yield this.core.memory.write32(3758157296 /* DHCSR */, -1604386816 /* DBGKEY */ |
                1 /* C_DEBUGEN */ |
                2 /* C_HALT */);
        });
    }
    /**
     * Set up (and disable) the Flash Patch & Breakpoint unit. It will be enabled when
     * the first breakpoint is set.
     *
     * Also reads the number of available hardware breakpoints.
     */
    setupFpb() {
        return __awaiter(this, void 0, void 0, function* () {
            // setup FPB (breakpoint)
            const fpcr = yield this.core.memory.read32(3758104576 /* FP_CTRL */);
            const nbCode = ((fpcr >> 8) & 0x70) | ((fpcr >> 4) & 0xf);
            // const nbLit = (fpcr >> 7) & 0xf;
            // this.totalHWBreakpoints = nbCode;
            yield this.setFpbEnabled(false);
            for (let i = 0; i < nbCode; i++) {
                this.availableHWBreakpoints.push(3758104584 /* FP_COMP0 */ + (4 * i));
                yield this.core.memory.write32(3758104584 /* FP_COMP0 */ + (i * 4), 0);
            }
        });
    }
    /**
     * Enable or disable the Flash Patch and Breakpoint unit (FPB).
     *
     * @param enabled
     */
    setFpbEnabled(enabled = true) {
        return __awaiter(this, void 0, void 0, function* () {
            this.enabled = enabled;
            yield this.core.memory.write32(3758104576 /* FP_CTRL */, 2 /* FP_CTRL_KEY */ | (enabled ? 1 : 0));
        });
    }
}
exports.Debug = Debug;



},{"./breakpoint":6}],8:[function(require,module,exports){
"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const util_1 = require("../util");
const prepared_1 = require("./prepared");
/**
 * # Memory Interface
 *
 * Controls access to the target's memory.
 *
 * ## Usage
 *
 * Using an instance of `CortexM`, as described before, we can simply read and
 * write numbers to memory as follows:
 *
 * ```typescript
 * const mem = core.memory;
 *
 * // NOTE: the address parameter must be word (4-byte) aligned.
 * await mem.write32(0x200000, 12345);
 * const val = await mem.read32(0x200000);
 *
 * // val === 12345
 *
 * // NOTE: the address parameter must be half-word (2-byte) aligned
 * await mem.write16(0x2000002, 65534);
 * const val16 = await mem.read16(0x2000002);
 *
 * // val16 === 65534
 * ```
 *
 * To write a larger block of memory, we can use `readBlock` and `writeBlock`. Again,
 * these blocks must be written to word-aligned addresses in memory.
 *
 * ```typescript
 * const data = new Uint32Array([0x1234, 0x5678, 0x9ABC, 0xDEF0]);
 * await mem.writeBlock(0x200000, data);
 *
 * const readData = await mem.readBlock(0x200000, data.length, 0x100);
 * ```
 *
 * ## See also
 *
 * `PreparedMemoryCommand` provides an equivalent API with better performance (in some
 * cases) by enabling batched memory operations.
 */
class Memory {
    constructor(dev) {
        this.dev = dev;
    }
    /**
     * Write a 32-bit word to the specified (word-aligned) memory address.
     *
     * @param addr Memory address to write to
     * @param data Data to write (values above 2**32 will be truncated)
     */
    write32(addr, data) {
        return __awaiter(this, void 0, void 0, function* () {
            const prep = this.dev.prepareCommand();
            prep.writeAp(0 /* CSW */, 587202640 /* CSW_VALUE */ | 2 /* CSW_SIZE32 */);
            prep.writeAp(4 /* TAR */, addr);
            prep.writeAp(12 /* DRW */, data);
            yield prep.go();
        });
    }
    /**
     * Write a 16-bit word to the specified (half word-aligned) memory address.
     *
     * @param addr Memory address to write to
     * @param data Data to write (values above 2**16 will be truncated)
     */
    write16(addr, data) {
        return __awaiter(this, void 0, void 0, function* () {
            data = data << ((addr & 0x02) << 3);
            const prep = this.dev.prepareCommand();
            prep.writeAp(0 /* CSW */, 587202640 /* CSW_VALUE */ | 1 /* CSW_SIZE16 */);
            prep.writeAp(4 /* TAR */, addr);
            prep.writeAp(12 /* DRW */, data);
            yield prep.go();
        });
    }
    /**
     * Read a 32-bit word from the specified (word-aligned) memory address.
     *
     * @param addr Memory address to read from.
     */
    read32(addr) {
        return __awaiter(this, void 0, void 0, function* () {
            const prep = this.dev.prepareCommand();
            prep.writeAp(0 /* CSW */, 587202640 /* CSW_VALUE */ | 2 /* CSW_SIZE32 */);
            prep.writeAp(4 /* TAR */, addr);
            prep.readAp(12 /* DRW */);
            try {
                return (yield prep.go())[0];
            }
            catch (e) {
                // transfer wait, try again.
                yield util_1.delay(100);
                return yield this.read32(addr);
            }
        });
    }
    /**
     * Read a 16-bit word from the specified (half word-aligned) memory address.
     *
     * @param addr Memory address to read from.
     */
    read16(addr) {
        return __awaiter(this, void 0, void 0, function* () {
            const prep = this.dev.prepareCommand();
            prep.writeAp(0 /* CSW */, 587202640 /* CSW_VALUE */ | 1 /* CSW_SIZE16 */);
            prep.writeAp(4 /* TAR */, addr);
            prep.readAp(12 /* DRW */);
            let val;
            try {
                val = (yield prep.go())[0];
            }
            catch (e) {
                // transfer wait, try again.
                yield util_1.delay(100);
                val = yield this.read16(addr);
            }
            val = (val >> ((addr & 0x02) << 3) & 0xffff);
            return val;
        });
    }
    /**
     * Reads a block of memory from the specified memory address.
     *
     * @param addr Address to read from
     * @param words Number of words to read
     * @param pageSize Memory page size
     */
    readBlock(addr, words, pageSize) {
        return __awaiter(this, void 0, void 0, function* () {
            const funs = [() => __awaiter(this, void 0, void 0, function* () { return Promise.resolve(); })];
            const bufs = [];
            const end = addr + words * 4;
            let ptr = addr;
            while (ptr < end) {
                let nextptr = ptr + pageSize;
                if (ptr === addr) {
                    nextptr &= ~(pageSize - 1);
                }
                const len = Math.min(nextptr - ptr, end - ptr);
                const ptr0 = ptr;
                util_1.assert((len & 3) === 0);
                funs.push(() => __awaiter(this, void 0, void 0, function* () {
                    bufs.push(yield this.readBlockCore(ptr0, len >> 2));
                }));
                ptr = nextptr;
            }
            for (const f of funs) {
                yield f();
            }
            const result = yield util_1.bufferConcat(bufs);
            return result.subarray(0, words * 4);
        });
    }
    /**
     * Write a block of memory to the specified memory address.
     *
     * @param addr Memory address to write to.
     * @param words Array of 32-bit words to write to memory.
     */
    writeBlock(addr, words) {
        return __awaiter(this, void 0, void 0, function* () {
            if (words.length === 0) {
                return;
            }
            return this.writeBlockCore(addr, words);
        });
    }
    prepareCommand() {
        return new prepared_1.PreparedMemoryCommand(this.dev);
    }
    readBlockCore(addr, words) {
        return __awaiter(this, void 0, void 0, function* () {
            const prep = this.dev.prepareCommand();
            prep.writeAp(0 /* CSW */, 587202640 /* CSW_VALUE */ | 2 /* CSW_SIZE32 */);
            prep.writeAp(4 /* TAR */, addr);
            yield prep.go();
            let lastSize = words % 15;
            if (lastSize === 0) {
                lastSize = 15;
            }
            const blocks = [];
            for (let i = 0; i < Math.ceil(words / 15); i++) {
                const b = yield this.dev.readRegRepeat(util_1.apReg(12 /* DRW */, 2 /* READ */), i === blocks.length - 1 ? lastSize : 15);
                blocks.push(b);
            }
            return util_1.bufferConcat(blocks);
        });
    }
    writeBlockCore(addr, words) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const blSz = 14;
                const reg = util_1.apReg(12 /* DRW */, 0 /* WRITE */);
                const prep = this.dev.prepareCommand();
                prep.writeAp(0 /* CSW */, 587202640 /* CSW_VALUE */ | 2 /* CSW_SIZE32 */);
                prep.writeAp(4 /* TAR */, addr);
                for (let i = 0; i < Math.ceil(words.length / blSz); i++) {
                    prep.writeRegRepeat(reg, words.subarray(i * blSz, i * blSz + blSz));
                }
                yield prep.go();
            }
            catch (e) {
                if (e.dapWait) {
                    yield util_1.delay(100);
                    return yield this.writeBlockCore(addr, words);
                }
                else {
                    throw e;
                }
            }
        });
    }
}
exports.Memory = Memory;



},{"../util":17,"./prepared":9}],9:[function(require,module,exports){
"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * # Prepared Memory Command
 *
 * Allows multiple memory operations to be batched together to improve HID
 * interface utilisation.
 *
 * ## Usage
 *
 * Similarly to `CortexMPreparedCommand` and `DapPreparedCommand`, a convenience
 * function exists to quickly create a prepared memory command:
 *
 * ```typescript
 * const prep = core.memory.prepareCommand();
 * ```
 *
 * You can then construct the sequence of commands using the same API as `Memory`.
 *
 * ```typescript
 * prep.write32(0x20000, 1234);
 * prep.write32(0x12344, 5678);
 * prep.write16(0x12346, 123);
 * ```
 *
 * And then dispatch the prepared commands asynchronously:
 *
 * ```typescript
 * await prep.go();
 * ```
 */
class PreparedMemoryCommand {
    constructor(dap) {
        this.cmd = dap.prepareCommand();
    }
    /**
     * Schedule a 32-bit memory write operation.
     *
     * @param addr Word-aligned memory address to write to.
     * @param data Number to be written.
     */
    write32(addr, data) {
        this.cmd.writeAp(0 /* CSW */, 587202640 /* CSW_VALUE */ | 2 /* CSW_SIZE32 */);
        this.cmd.writeAp(4 /* TAR */, addr);
        this.cmd.writeAp(12 /* DRW */, data);
    }
    /**
     * Schedule a 16-bit memory write operation.
     *
     * @param addr Half word-aligned memory address to write to.
     * @param data Number to be written.
     */
    write16(addr, data) {
        data = data << ((addr & 0x02) << 3);
        this.cmd.writeAp(0 /* CSW */, 587202640 /* CSW_VALUE */ | 1 /* CSW_SIZE16 */);
        this.cmd.writeAp(4 /* TAR */, addr);
        this.cmd.writeAp(12 /* DRW */, data);
    }
    /**
     * Schedule a 32-bit memory read operation.
     *
     * @param addr Word-aligned memory address to read from.
     */
    read32(addr) {
        this.cmd.writeAp(0 /* CSW */, 587202640 /* CSW_VALUE */ | 2 /* CSW_SIZE32 */);
        this.cmd.writeAp(4 /* TAR */, addr);
        this.cmd.readAp(12 /* DRW */);
    }
    /**
     * Schedule a 16-bit memory read operation.
     *
     * FIXME: the values need to be shifted after being read.
     *
     * @param addr Half word-aligned memory address to read from.
     */
    read16(addr) {
        this.cmd.writeAp(0 /* CSW */, 587202640 /* CSW_VALUE */ | 1 /* CSW_SIZE16 */);
        this.cmd.writeAp(4 /* TAR */, addr);
        this.cmd.readAp(12 /* DRW */);
    }
    /**
     * Execute all commands asynchronously.
     */
    go() {
        return __awaiter(this, void 0, void 0, function* () {
            return this.cmd.go();
        });
    }
}
exports.PreparedMemoryCommand = PreparedMemoryCommand;



},{}],10:[function(require,module,exports){
(function (Buffer){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const MemoryMap = require("nrf-intel-hex");
const util_1 = require("../util");
class FlashSection {
    constructor(address, data) {
        this.address = address;
        this.data = data;
        /* empty */
    }
    toString() {
        return `${this.data.byteLength} bytes @ ${this.address.toString(16)}`;
    }
}
exports.FlashSection = FlashSection;
/**
 * # Flash Program
 *
 * Represents a program to be flashed to memory as a series of disjoint sections
 * in memory/flash.
 *
 * ## Usage
 *
 * Use with a hex file is as simple as loading it from disk, and calling `fromIntelHex`.
 *
 * ```typescript
 * const hexFile = "microbit.hex";
 * const hexData = fs.readFileSync(hexFile, { encoding: 'utf-8' });
 *
 * const program = FlashProgram.fromIntelHex(hexData);
 * core.program(program, (progress) => {
 *     console.log(`Flash progress: ${progress * 100}%`);
 * });
 * ```
 *
 * When used with a binary file, you must make sure that the file is stored in a
 * Uint32Array, and you must provide a base address for the binary to be written to.
 * The base address is commonly zero.
 */
class FlashProgram {
    constructor(sections) {
        this.sections = sections;
    }
    static fromArrayBuffer(buffer) {
        if (util_1.isBufferBinary(buffer)) {
            return FlashProgram.fromBinary(0, new Uint32Array(buffer));
        }
        const bufferString = Buffer.from(buffer).toString("utf8");
        return FlashProgram.fromIntelHex(bufferString);
    }
    static fromIntelHex(hex) {
        const hexMemory = MemoryMap.fromHex(hex);
        const flashSections = [];
        hexMemory.forEach((value, key) => {
            flashSections.push(new FlashSection(key, new Uint32Array(value.buffer)));
        });
        return new FlashProgram(flashSections);
    }
    static fromBinary(addr, bin) {
        return new FlashProgram([new FlashSection(addr, bin)]);
    }
    totalByteLength() {
        return this.sections.map(s => s.data.byteLength).reduce((x, y) => x + y);
    }
    toString() {
        return this.sections.toString();
    }
}
exports.FlashProgram = FlashProgram;



}).call(this,require("buffer").Buffer)
},{"../util":17,"buffer":20,"nrf-intel-hex":22}],11:[function(require,module,exports){
"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const cortex_1 = require("../cortex/cortex");
const K64F_1 = require("./K64F");
const NRF51_1 = require("./NRF51");
/**
 * Analyzer code blob, from PyOCD. This can be used to compute a table of CRC
 * values. See https://github.com/mbedmicro/pyOCD/tree/master/src/analyzer.
 */
const analyzer = new Uint32Array([
    0x2180468c, 0x2600b5f0, 0x4f2c2501, 0x447f4c2c, 0x1c2b0049, 0x425b4033, 0x40230872, 0x085a4053,
    0x425b402b, 0x40534023, 0x402b085a, 0x4023425b, 0x085a4053, 0x425b402b, 0x40534023, 0x402b085a,
    0x4023425b, 0x085a4053, 0x425b402b, 0x40534023, 0x402b085a, 0x4023425b, 0x085a4053, 0x425b402b,
    0x40534023, 0xc7083601, 0xd1d2428e, 0x2b004663, 0x4663d01f, 0x46b4009e, 0x24ff2701, 0x44844d11,
    0x1c3a447d, 0x88418803, 0x4351409a, 0xd0122a00, 0x22011856, 0x780b4252, 0x40533101, 0x009b4023,
    0x0a12595b, 0x42b1405a, 0x43d2d1f5, 0x4560c004, 0x2000d1e7, 0x2200bdf0, 0x46c0e7f8, 0x000000b6,
    0xedb88320, 0x00000044,
]);
/**
 * # Flash Target
 *
 * Represents a target device containing a flash region. In rare cases that a
 * target chip only has RAM, uploading a program is as simple as writing a
 * block of data to memory.
 *
 * ## Usage
 *
 * Initialising the `FlashTarget` object is the same as configuring a Cortex-M
 * object, but with an additional parameter for the platform (contains the
 * flashing algorithm and memory layout).
 *
 * ```typescript
 * import {K64F, DAP, FlashTarget} from "dapjs";
 *
 * // make sure hid is an object implementing the `IHID` interface.
 * const dap = new DAP(hid);
 * const device = new FlashTarget(dap, K64F);
 * ```
 *
 * Now, we can do all of the operations you'd expect. As usual, these examples
 * work in a function marked `async`. Alternatively, they can be implemented
 * using Promises directly.
 *
 * ```typescript
 * await device.eraseChip();
 *
 * // flash a hex program
 *
 * ```
 */
class FlashTarget extends cortex_1.CortexM {
    constructor(device, platform) {
        super(device);
        this.platform = platform;
        this.inited = false;
    }
    /**
     * Initialise the flash driver on the chip. Must be called before any of the other
     * flash-related methods.
     */
    flashInit() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.inited) {
                return;
            }
            // reset and halt
            yield this.reset(true);
            // make sure we're in Thumb mode.
            yield this.writeCoreRegister(16 /* XPSR */, 1 << 24);
            yield this.writeCoreRegister(9 /* R9 */, this.platform.flashAlgo.staticBase);
            // upload analyzer
            if (this.platform.flashAlgo.analyzerSupported) {
                yield this.memory.writeBlock(this.platform.flashAlgo.analyzerAddress, analyzer);
            }
            const result = yield this.runCode(this.platform.flashAlgo.instructions, this.platform.flashAlgo.loadAddress, this.platform.flashAlgo.pcInit, this.platform.flashAlgo.loadAddress + 1, this.platform.flashAlgo.stackPointer, true, 0, 0, 0, 0);
            this.inited = true;
            return result;
        });
    }
    /**
     * Erase _all_ data stored in flash on the chip.
     */
    eraseChip() {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.inited) {
                yield this.flashInit();
            }
            const result = yield this.runCode(this.platform.flashAlgo.instructions, this.platform.flashAlgo.loadAddress, this.platform.flashAlgo.pcEraseAll, this.platform.flashAlgo.loadAddress + 1, this.platform.flashAlgo.stackPointer, false, 0, 0, 0);
            return result;
        });
    }
    /**
     * Flash a contiguous block of data to flash at a specified address.
     *
     * @param data Array of 32-bit integers to write to flash.
     * @param address Memory address in flash to write to.
     * @param progressCb Callback to keep track of progress through upload (from 0.0 to 1.0)
     */
    flash(data, address, progressCb) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.inited) {
                yield this.flashInit();
            }
            const pageSizeWords = this.platform.flashAlgo.pageSize / 4;
            const bufferAddress = this.platform.flashAlgo.pageBuffers[0];
            const flashStart = address || this.platform.flashAlgo.flashStart;
            // How far through `data` are we (in bytes)
            let ptr = 0;
            while (ptr < data.byteLength) {
                const wordPtr = ptr / 4;
                const pageData = data.subarray(wordPtr, wordPtr + pageSizeWords);
                const flashAddress = flashStart + ptr;
                yield this.memory.writeBlock(bufferAddress, pageData);
                yield this.runCode(this.platform.flashAlgo.instructions, this.platform.flashAlgo.loadAddress, this.platform.flashAlgo.pcProgramPage, // pc
                this.platform.flashAlgo.loadAddress + 1, // lr
                this.platform.flashAlgo.stackPointer, // sp
                /* upload? */
                false, 
                /* args */
                flashAddress, this.platform.flashAlgo.pageSize, bufferAddress);
                if (progressCb) {
                    progressCb(ptr / data.byteLength);
                }
                ptr += pageData.byteLength;
            }
            if (progressCb) {
                progressCb(1.0);
            }
        });
    }
    /**
     * Upload a program consisting of one or more disjoint sections to flash.
     *
     * @param program Program to be uploaded
     * @param progressCb Callback to receive progress updates (from 0.0 to 1.0)
     */
    program(program, progressCb) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.flashInit();
            yield this.eraseChip();
            const totalBytes = program.totalByteLength();
            let cumulativeBytes = 0;
            // const startTime = Date.now();
            for (const section of program.sections) {
                yield this.flash(section.data, section.address, progress => {
                    const sectionBytes = section.data.byteLength * progress;
                    progressCb((cumulativeBytes + sectionBytes) / totalBytes);
                });
                cumulativeBytes += section.data.byteLength;
            }
            // const endTime = Date.now();
            // const elapsedTime = endTime - startTime;
            // const transferRate = totalBytes / elapsedTime; // B/ms == kB/s
            yield this.flashUnInit();
            progressCb(1.0);
        });
    }
    /**
     * Un-init the flash algorithm. Commonly, we use this to ensure that the flashing
     * algorithms are re-uploaded after resets.
     */
    flashUnInit() {
        this.inited = false;
    }
}
exports.FlashTarget = FlashTarget;
/**
 * Map of mbed device codes to platform objects. Can be used by applications
 * to dynamically select flashing algorithm based on the devices connected to
 * the computer.
 *
 * > *TODO:* extend the mbed devices API to include data stored here, so that we can
 * > expand to cover all devices without needing to update DAP.js.
 */
exports.FlashTargets = new Map();
exports.FlashTargets.set("0240", new K64F_1.K64F());
exports.FlashTargets.set("9900", new NRF51_1.NRF51());
exports.FlashTargets.set("1100", new NRF51_1.NRF51());



},{"../cortex/cortex":2,"./K64F":12,"./NRF51":13}],12:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const K64F_FLASH_ALGO = {
    analyzerAddress: 0x1ffff000,
    analyzerSupported: true,
    flashSize: 0x100000,
    flashStart: 0x0,
    // Flash algorithm as a hex string
    instructions: new Uint32Array([
        0xE00ABE00, 0x062D780D, 0x24084068, 0xD3000040, 0x1E644058, 0x1C49D1FA, 0x2A001E52, 0x4770D1F2,
        0x4604b570, 0x4616460d, 0x5020f24c, 0x81c84932, 0x1028f64d, 0x460881c8, 0xf0208800, 0x80080001,
        0x4448482e, 0xf8dcf000, 0x2001b108, 0x2000bd70, 0x4601e7fc, 0x47702000, 0x4929b510, 0x44484827,
        0xf8b8f000, 0xb92c4604, 0x48242100, 0xf0004448, 0x4604f9a9, 0xf837f000, 0xbd104620, 0x4604b570,
        0x4448481e, 0x46214b1e, 0xf00068c2, 0x4605f85d, 0x481ab93d, 0x23004448, 0x68c24621, 0xf946f000,
        0xf0004605, 0x4628f820, 0xb5febd70, 0x460c4605, 0x46234616, 0x46294632, 0x44484810, 0xf8f8f000,
        0xb9674607, 0x22012000, 0x2000e9cd, 0x46224633, 0x90024629, 0x44484809, 0xf984f000, 0xf0004607,
        0x4638f802, 0x4807bdfe, 0xf4206840, 0xf5000070, 0x49040070, 0x47706048, 0x40052000, 0x00000004,
        0x6b65666b, 0x4001f000, 0x4a0e2070, 0x20807010, 0xbf007010, 0x7800480b, 0x280009c0, 0x4809d0fa,
        0xf0017801, 0xb1080020, 0x47702067, 0x0010f001, 0x2068b108, 0xf001e7f9, 0xb1080001, 0xe7f42069,
        0xe7f22000, 0x40020000, 0x4df0e92d, 0x460d4604, 0x469a4690, 0xf0004650, 0x4606f891, 0x4630b116,
        0x8df0e8bd, 0x46422310, 0x46204629, 0xf86cf000, 0xb10e4606, 0xe7f34630, 0x0008eb05, 0x68e01e47,
        0xf1f0fbb7, 0x7011fb00, 0x68e0b140, 0xf0f0fbb7, 0x0b01f100, 0xfb0068e0, 0x1e47f00b, 0x480be011,
        0x68004478, 0x20096005, 0x71c84909, 0xffacf7ff, 0x69a04606, 0x69a0b108, 0xb1064780, 0x68e0e003,
        0x42bd4405, 0xbf00d9eb, 0xe7c94630, 0x000002ec, 0x40020000, 0x4604b570, 0x4628460d, 0xf84ef000,
        0xb10e4606, 0xbd704630, 0x2004b90c, 0x2044e7fb, 0x71c84902, 0xff88f7ff, 0x0000e7f5, 0x40020000,
        0xb9094601, 0x47702004, 0x6cc04826, 0x6003f3c0, 0x447b4b25, 0x0010f833, 0xb90a0302, 0xe7f22064,
        0x60082000, 0x2002604a, 0x02c06088, 0x200060c8, 0x61486108, 0xbf006188, 0x4602e7e5, 0x2004b90a,
        0x61914770, 0xe7fb2000, 0x4604b530, 0x2004b90c, 0x1e58bd30, 0xb9104008, 0x40101e58, 0x2065b108,
        0x6820e7f6, 0xd8054288, 0x0500e9d4, 0x188d4428, 0xd20142a8, 0xe7eb2066, 0xe7e92000, 0x480b4601,
        0xd0014281, 0x4770206b, 0xe7fc2000, 0xb90b4603, 0x47702004, 0xd801290f, 0xd0012a04, 0xe7f82004,
        0xe7f62000, 0x40048000, 0x0000025a, 0x6b65666b, 0x41f0e92d, 0x46884607, 0x461d4614, 0x2004b914,
        0x81f0e8bd, 0x462a2308, 0x46384641, 0xffbcf7ff, 0xb10e4606, 0xe7f34630, 0x4812e01f, 0x68004478,
        0x8000f8c0, 0x490fcc01, 0x390c4479, 0x60486809, 0x490ccc01, 0x39184479, 0x60886809, 0x490a2007,
        0xf7ff71c8, 0x4606ff01, 0xb10869b8, 0x478069b8, 0xe004b106, 0x0808f108, 0x2d003d08, 0xbf00d1dd,
        0xe7cd4630, 0x000001b0, 0x40020000, 0x4dffe92d, 0x4682b082, 0x2310460c, 0x46504621, 0xf7ff9a04,
        0x4683ff83, 0x0f00f1bb, 0x4658d003, 0xe8bdb006, 0xe9da8df0, 0xfbb00101, 0x4260f7f1, 0x40084279,
        0x42a54245, 0x443dd100, 0xe0229e04, 0x0804eba5, 0xd90045b0, 0xea4f46b0, 0x90011018, 0x4478480f,
        0x60046800, 0x490e2001, 0x980171c8, 0x72c80a00, 0x72889801, 0x72489805, 0xfeb6f7ff, 0xf1bb4683,
        0xd0010f00, 0xe7d14658, 0x0608eba6, 0x443d4444, 0x2e00bf00, 0x2000d1da, 0x0000e7c8, 0x0000010e,
        0x40020000, 0x4604b570, 0xb90c460d, 0xbd702004, 0x49032040, 0x460871c8, 0xf7ff7185, 0xe7f6fe95,
        0x40020000, 0x4dffe92d, 0x4617460c, 0xe9dd461d, 0xf8ddb80c, 0xb91da038, 0xb0042004, 0x8df0e8bd,
        0x463a2304, 0x98004621, 0xff1ef7ff, 0xb10e4606, 0xe7f24630, 0x4814e022, 0x68004478, 0x20026004,
        0x71c84912, 0xf8804608, 0x490fb00b, 0x39144479, 0x68096828, 0xf7ff6088, 0x4606fe67, 0xf1b8b15e,
        0xd0010f00, 0x4000f8c8, 0x0f00f1ba, 0x2000d002, 0x0000f8ca, 0x1f3fe004, 0x1d241d2d, 0xd1da2f00,
        0x4630bf00, 0x0000e7c9, 0x00000074, 0x40020000, 0x00000000, 0x00080000, 0x00100000, 0x00200000,
        0x00400000, 0x00800000, 0x01000000, 0x01000000, 0x40020004, 0x00000000,
    ]),
    loadAddress: 0x20000000,
    pageBuffers: [0x20003000, 0x20004000],
    pageSize: 0x1000,
    // Relative function addresses
    pcEraseAll: 0x20000059,
    pcEraseSector: 0x2000007D,
    pcInit: 0x20000021,
    // pcUnInit: 0x49,
    pcProgramPage: 0x200000AB,
    stackPointer: 0x20001000,
    staticBase: 0x20000000 + 0x20 + 0x474,
};
class K64F {
    constructor() {
        this.flashAlgo = K64F_FLASH_ALGO;
    }
    overrideSecurityBits(address, data) {
        const u8data = new Uint8Array(data.buffer);
        // Kinetis security values and addresses
        const SECURITY_START = 0x400;
        const SECURITY_SIZE = 16;
        const FPROT_ADDR = 0x408;
        const FPROT_ADDR_END = 0x40c;
        // const FPROT_SIZE = 4;
        const FSEC_ADDR = 0x40c;
        const FSEC_VAL = 0xFE;
        // const FOPT_ADDR = 0x40d;
        // const FOPT_VAL = 0xFF;
        const FEPROT_ADDR = 0x40e;
        const FEPROT_VAL = 0xFF;
        const FDPROT_ADDR = 0x40f;
        const FDPROT_VAL = 0xFF;
        if (address <= SECURITY_START && address + u8data.byteLength > SECURITY_START + SECURITY_SIZE) {
            for (let i = FPROT_ADDR; i < FPROT_ADDR_END; i++) {
                if (u8data[i - address] !== 0xff) {
                    u8data[i - address] = 0xff;
                }
            }
            if (u8data[FSEC_ADDR - address] !== FSEC_VAL) {
                u8data[FSEC_ADDR - address] = FSEC_VAL;
            }
            // if (u8data[FOPT_ADDR - address] === 0x00) {
            // }
            if (u8data[FEPROT_ADDR - address] !== FEPROT_VAL) {
                u8data[FEPROT_ADDR - address] = FEPROT_VAL;
            }
            if (u8data[FDPROT_ADDR - address] !== FDPROT_VAL) {
                u8data[FDPROT_ADDR - address] = FDPROT_VAL;
            }
        }
    }
}
exports.K64F = K64F;



},{}],13:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const NRF51_FLASH_ALGO = {
    analyzerAddress: 0x20003000,
    analyzerSupported: true,
    beginData: 0x20002000,
    flashSize: 0x40000,
    flashStart: 0x0,
    instructions: new Uint32Array([
        0xE00ABE00, 0x062D780D, 0x24084068, 0xD3000040, 0x1E644058, 0x1C49D1FA, 0x2A001E52, 0x4770D1F2,
        0x47702000, 0x47702000, 0x4c26b570, 0x60602002, 0x60e02001, 0x68284d24, 0xd00207c0, 0x60602000,
        0xf000bd70, 0xe7f6f82c, 0x4c1eb570, 0x60612102, 0x4288491e, 0x2001d302, 0xe0006160, 0x4d1a60a0,
        0xf81df000, 0x07c06828, 0x2000d0fa, 0xbd706060, 0x4605b5f8, 0x4813088e, 0x46142101, 0x4f126041,
        0xc501cc01, 0x07c06838, 0x1e76d006, 0x480dd1f8, 0x60412100, 0xbdf84608, 0xf801f000, 0x480ce7f2,
        0x06006840, 0xd00b0e00, 0x6849490a, 0xd0072900, 0x4a0a4909, 0xd00007c3, 0x1d09600a, 0xd1f90840,
        0x00004770, 0x4001e500, 0x4001e400, 0x10001000, 0x40010400, 0x40010500, 0x40010600, 0x6e524635,
        0x00000000,
    ]),
    loadAddress: 0x20000000,
    minProgramLength: 4,
    pageBuffers: [0x20002000, 0x20002400],
    pageSize: 0x400,
    pcEraseAll: 0x20000029,
    pcEraseSector: 0x20000049,
    pcInit: 0x20000021,
    pcProgramPage: 0x20000071,
    stackPointer: 0x20001000,
    staticBase: 0x20000170,
};
class NRF51 {
    constructor() {
        this.flashAlgo = NRF51_FLASH_ALGO;
    }
    overrideSecurityBits(_address, _data) {
        /* empty */
    }
}
exports.NRF51 = NRF51;



},{}],14:[function(require,module,exports){
"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
class PlatformSelector {
    constructor() {
        this.deviceCache = new Map();
    }
    lookupDevice(code) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.deviceCache.has(code)) {
                return this.deviceCache.get(code);
            }
            const xhr = new XMLHttpRequest();
            xhr.open("get", `https://os.mbed.com/api/v3/platforms/${code}/`, true);
            xhr.responseType = "json";
            return new Promise((resolve, _reject) => {
                xhr.onload = (_e) => {
                    const device = {
                        id: xhr.response.id,
                        name: xhr.response.name,
                        productCode: xhr.response.productcode,
                    };
                    this.deviceCache.set(code, device);
                    resolve(device);
                };
                xhr.send();
            });
        });
    }
}
exports.PlatformSelector = PlatformSelector;



},{}],15:[function(require,module,exports){
"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const util_1 = require("../util");
class CMSISDAP {
    // private maxSent = 1;
    constructor(hid) {
        this.hid = hid;
    }
    resetTarget() {
        return __awaiter(this, void 0, void 0, function* () {
            return this.cmdNums(10 /* DAP_RESET_TARGET */, []);
        });
    }
    disconnect() {
        return __awaiter(this, void 0, void 0, function* () {
            return this.cmdNums(3 /* DAP_DISCONNECT */, []);
        });
    }
    cmdNums(op, data) {
        return __awaiter(this, void 0, void 0, function* () {
            data.unshift(op);
            const buf = yield this.send(data);
            if (buf[0] !== op) {
                throw new Error(`Bad response for ${op} -> ${buf[0]}`);
            }
            switch (op) {
                case 2 /* DAP_CONNECT */:
                case 0 /* DAP_INFO */:
                case 5 /* DAP_TRANSFER */:
                case 6 /* DAP_TRANSFER_BLOCK */:
                    break;
                default:
                    if (buf[1] !== 0) {
                        throw new Error(`Bad status for ${op} -> ${buf[1]}`);
                    }
            }
            return buf;
        });
    }
    connect() {
        return __awaiter(this, void 0, void 0, function* () {
            const v = yield this.info(254 /* PACKET_COUNT */);
            if (v) {
                // this.maxSent = v as number;
            }
            else {
                throw new Error("DAP_INFO returned invalid packet count.");
            }
            yield this.cmdNums(17 /* DAP_SWJ_CLOCK */, util_1.addInt32(null, 10000000));
            const buf = yield this.cmdNums(2 /* DAP_CONNECT */, [0]);
            if (buf[1] !== 1) {
                throw new Error("SWD mode not enabled.");
            }
            yield this.cmdNums(17 /* DAP_SWJ_CLOCK */, util_1.addInt32(null, 10000000));
            yield this.cmdNums(4 /* DAP_TRANSFER_CONFIGURE */, [0, 0x50, 0, 0, 0]);
            yield this.cmdNums(19 /* DAP_SWD_CONFIGURE */, [0]);
            yield this.jtagToSwd();
        });
    }
    jtagToSwd() {
        return __awaiter(this, void 0, void 0, function* () {
            const arrs = [
                [56, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff],
                [16, 0x9e, 0xe7],
                [56, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff],
                [8, 0x00],
            ];
            for (const arr of arrs) {
                yield this.swjSequence(arr);
            }
        });
    }
    swjSequence(data) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.cmdNums(18 /* DAP_SWJ_SEQUENCE */, data);
        });
    }
    info(id) {
        return __awaiter(this, void 0, void 0, function* () {
            const buf = yield this.cmdNums(0 /* DAP_INFO */, [id]);
            if (buf[1] === 0) {
                return null;
            }
            switch (id) {
                case 240 /* CAPABILITIES */:
                case 254 /* PACKET_COUNT */:
                case 255 /* PACKET_SIZE */:
                    if (buf[1] === 1) {
                        return buf[2];
                    }
                    else if (buf[1] === 2) {
                        return buf[3] << 8 | buf[2];
                    }
            }
            return buf.subarray(2, buf[1] + 2 - 1); // .toString("utf8")
        });
    }
    send(command) {
        return __awaiter(this, void 0, void 0, function* () {
            const array = Uint8Array.from(command);
            yield this.hid.write(array.buffer);
            const response = yield this.hid.read();
            return new Uint8Array(response.buffer);
        });
    }
}
exports.CMSISDAP = CMSISDAP;



},{"../util":17}],16:[function(require,module,exports){
"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
function bufferExtend(source, length) {
    const sarr = new Uint8Array(source);
    const dest = new ArrayBuffer(length);
    const darr = new Uint8Array(dest);
    for (let i = 0; i < Math.min(source.byteLength, length); i++) {
        darr[i] = sarr[i];
    }
    return dest;
}
class HID {
    constructor(device) {
        this.packetSize = 64;
        this.controlTransferGetReport = 0x01;
        this.controlTransferSetReport = 0x09;
        this.controlTransferOutReport = 0x200;
        this.controlTransferInReport = 0x100;
        this.device = device;
    }
    open(hidInterfaceClass = 0xFF, useControlTransfer = true) {
        return __awaiter(this, void 0, void 0, function* () {
            this.useControlTransfer = useControlTransfer;
            yield this.device.open();
            yield this.device.selectConfiguration(1);
            const hids = this.device.configuration.interfaces.filter(intf => intf.alternates[0].interfaceClass === hidInterfaceClass);
            if (hids.length === 0) {
                throw new Error("No HID interfaces found.");
            }
            this.interfaces = hids;
            if (this.interfaces.length === 1) {
                this.interface = this.interfaces[0];
            }
            yield this.device.claimInterface(this.interface.interfaceNumber);
            this.endpoints = this.interface.alternates[0].endpoints;
            this.epIn = null;
            this.epOut = null;
            for (const endpoint of this.endpoints) {
                if (endpoint.direction === "in") {
                    this.epIn = endpoint;
                }
                else {
                    this.epOut = endpoint;
                }
            }
        });
    }
    close() {
        return __awaiter(this, void 0, void 0, function* () {
            return this.device.close();
        });
    }
    write(data) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.epOut && !this.useControlTransfer) {
                const reportSize = this.epOut.packetSize;
                const buffer = bufferExtend(data, reportSize);
                return this.device.transferOut(this.epOut.endpointNumber, buffer);
            }
            else {
                // Device does not have out endpoint. Send data using control transfer
                const buffer = bufferExtend(data, this.packetSize);
                return this.device.controlTransferOut({
                    requestType: "class",
                    recipient: "interface",
                    request: this.controlTransferSetReport,
                    value: this.controlTransferOutReport,
                    index: this.interface.interfaceNumber
                }, buffer);
            }
        });
    }
    read() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.epIn && !this.useControlTransfer) {
                const reportSize = this.epIn.packetSize;
                return this.device.transferIn(this.epIn.endpointNumber, reportSize)
                    .then(res => res.data);
            }
            else {
                return this.device.controlTransferIn({
                    requestType: "class",
                    recipient: "interface",
                    request: this.controlTransferGetReport,
                    value: this.controlTransferInReport,
                    index: this.interface.interfaceNumber
                }, this.packetSize).then(res => res.data);
            }
        });
    }
}
exports.HID = HID;



},{}],17:[function(require,module,exports){
(function (Buffer){
"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.readUInt32LE = (b, idx) => {
    return (b[idx] |
        (b[idx + 1] << 8) |
        (b[idx + 2] << 16) |
        (b[idx + 3] << 24)) >>> 0;
};
exports.bufferConcat = (bufs) => {
    let len = 0;
    for (const b of bufs) {
        len += b.length;
    }
    const r = new Uint8Array(len);
    len = 0;
    for (const b of bufs) {
        r.set(b, len);
        len += b.length;
    }
    return r;
};
exports.delay = (t) => __awaiter(this, void 0, void 0, function* () {
    return new Promise(resolve => {
        setTimeout(resolve, t);
    });
});
exports.addInt32 = (arr, val) => {
    if (!arr) {
        arr = [];
    }
    arr.push(val & 0xff, (val >> 8) & 0xff, (val >> 16) & 0xff, (val >> 24) & 0xff);
    return arr;
};
exports.hex = (v) => {
    return "0x" + v.toString(16);
};
exports.rid = (v) => {
    const m = [
        "DP_0x0",
        "DP_0x4",
        "DP_0x8",
        "DP_0xC",
        "AP_0x0",
        "AP_0x4",
        "AP_0x8",
        "AP_0xC",
    ];
    return m[v] || "?";
};
exports.bank = (addr) => {
    const APBANKSEL = 0x000000f0;
    return (addr & APBANKSEL) | (addr & 0xff000000);
};
exports.apReg = (r, mode) => {
    const v = r | mode | 1 /* AP_ACC */;
    return (4 + ((v & 0x0c) >> 2));
};
exports.bufToUint32Array = (buf) => {
    exports.assert((buf.length & 3) === 0);
    const r = [];
    if (!buf.length) {
        return r;
    }
    r[buf.length / 4 - 1] = 0;
    for (let i = 0; i < r.length; ++i) {
        r[i] = exports.readUInt32LE(buf, i << 2);
    }
    return r;
};
exports.assert = (cond) => {
    if (!cond) {
        throw new Error("assertion failed");
    }
};
exports.regRequest = (regId, isWrite = false) => {
    let request = !isWrite ? 2 /* READ */ : 0 /* WRITE */;
    if (regId < 4) {
        request |= 0 /* DP_ACC */;
    }
    else {
        request |= 1 /* AP_ACC */;
    }
    request |= (regId & 3) << 2;
    return request;
};
exports.hexBytes = (bytes) => {
    let chk = 0;
    let r = ":";
    bytes.forEach(b => chk += b);
    bytes.push((-chk) & 0xff);
    bytes.forEach(b => r += ("0" + b.toString(16)).slice(-2));
    return r.toUpperCase();
};
exports.isBufferBinary = (buffer) => {
    // detect if buffer contains text or binary data
    const lengthToCheck = buffer.byteLength > 50 ? 50 : buffer.byteLength;
    const bufferString = Buffer.from(buffer).toString("utf8");
    for (let i = 0; i < lengthToCheck; i++) {
        const charCode = bufferString.charCodeAt(i);
        // 65533 is a code for unknown character
        // 0-8 are codes for control characters
        if (charCode === 65533 || charCode <= 8) {
            return true;
        }
    }
    return false;
};



}).call(this,require("buffer").Buffer)
},{"buffer":20}],18:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var cortex_1 = require("./cortex/cortex");
exports.CortexM = cortex_1.CortexM;
var constants_1 = require("./cortex/constants");
exports.CoreNames = constants_1.CoreNames;
exports.ISANames = constants_1.ISANames;
var dap_1 = require("./dap/dap");
exports.DAP = dap_1.DAP;
var FlashTarget_1 = require("./targets/FlashTarget");
exports.FlashTargets = FlashTarget_1.FlashTargets;
exports.FlashTarget = FlashTarget_1.FlashTarget;
var FlashProgram_1 = require("./targets/FlashProgram");
exports.FlashProgram = FlashProgram_1.FlashProgram;
var PlatformSelector_1 = require("./targets/PlatformSelector");
exports.PlatformSelector = PlatformSelector_1.PlatformSelector;
var hid_1 = require("./transport/hid");
exports.HID = hid_1.HID;



},{"./cortex/constants":1,"./cortex/cortex":2,"./dap/dap":4,"./targets/FlashProgram":10,"./targets/FlashTarget":11,"./targets/PlatformSelector":14,"./transport/hid":16}],19:[function(require,module,exports){
'use strict'

exports.byteLength = byteLength
exports.toByteArray = toByteArray
exports.fromByteArray = fromByteArray

var lookup = []
var revLookup = []
var Arr = typeof Uint8Array !== 'undefined' ? Uint8Array : Array

var code = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
for (var i = 0, len = code.length; i < len; ++i) {
  lookup[i] = code[i]
  revLookup[code.charCodeAt(i)] = i
}

// Support decoding URL-safe base64 strings, as Node.js does.
// See: https://en.wikipedia.org/wiki/Base64#URL_applications
revLookup['-'.charCodeAt(0)] = 62
revLookup['_'.charCodeAt(0)] = 63

function placeHoldersCount (b64) {
  var len = b64.length
  if (len % 4 > 0) {
    throw new Error('Invalid string. Length must be a multiple of 4')
  }

  // the number of equal signs (place holders)
  // if there are two placeholders, than the two characters before it
  // represent one byte
  // if there is only one, then the three characters before it represent 2 bytes
  // this is just a cheap hack to not do indexOf twice
  return b64[len - 2] === '=' ? 2 : b64[len - 1] === '=' ? 1 : 0
}

function byteLength (b64) {
  // base64 is 4/3 + up to two characters of the original data
  return (b64.length * 3 / 4) - placeHoldersCount(b64)
}

function toByteArray (b64) {
  var i, l, tmp, placeHolders, arr
  var len = b64.length
  placeHolders = placeHoldersCount(b64)

  arr = new Arr((len * 3 / 4) - placeHolders)

  // if there are placeholders, only get up to the last complete 4 chars
  l = placeHolders > 0 ? len - 4 : len

  var L = 0

  for (i = 0; i < l; i += 4) {
    tmp = (revLookup[b64.charCodeAt(i)] << 18) | (revLookup[b64.charCodeAt(i + 1)] << 12) | (revLookup[b64.charCodeAt(i + 2)] << 6) | revLookup[b64.charCodeAt(i + 3)]
    arr[L++] = (tmp >> 16) & 0xFF
    arr[L++] = (tmp >> 8) & 0xFF
    arr[L++] = tmp & 0xFF
  }

  if (placeHolders === 2) {
    tmp = (revLookup[b64.charCodeAt(i)] << 2) | (revLookup[b64.charCodeAt(i + 1)] >> 4)
    arr[L++] = tmp & 0xFF
  } else if (placeHolders === 1) {
    tmp = (revLookup[b64.charCodeAt(i)] << 10) | (revLookup[b64.charCodeAt(i + 1)] << 4) | (revLookup[b64.charCodeAt(i + 2)] >> 2)
    arr[L++] = (tmp >> 8) & 0xFF
    arr[L++] = tmp & 0xFF
  }

  return arr
}

function tripletToBase64 (num) {
  return lookup[num >> 18 & 0x3F] + lookup[num >> 12 & 0x3F] + lookup[num >> 6 & 0x3F] + lookup[num & 0x3F]
}

function encodeChunk (uint8, start, end) {
  var tmp
  var output = []
  for (var i = start; i < end; i += 3) {
    tmp = ((uint8[i] << 16) & 0xFF0000) + ((uint8[i + 1] << 8) & 0xFF00) + (uint8[i + 2] & 0xFF)
    output.push(tripletToBase64(tmp))
  }
  return output.join('')
}

function fromByteArray (uint8) {
  var tmp
  var len = uint8.length
  var extraBytes = len % 3 // if we have 1 byte left, pad 2 bytes
  var output = ''
  var parts = []
  var maxChunkLength = 16383 // must be multiple of 3

  // go through the array every three bytes, we'll deal with trailing stuff later
  for (var i = 0, len2 = len - extraBytes; i < len2; i += maxChunkLength) {
    parts.push(encodeChunk(uint8, i, (i + maxChunkLength) > len2 ? len2 : (i + maxChunkLength)))
  }

  // pad the end with zeros, but make sure to not forget the extra bytes
  if (extraBytes === 1) {
    tmp = uint8[len - 1]
    output += lookup[tmp >> 2]
    output += lookup[(tmp << 4) & 0x3F]
    output += '=='
  } else if (extraBytes === 2) {
    tmp = (uint8[len - 2] << 8) + (uint8[len - 1])
    output += lookup[tmp >> 10]
    output += lookup[(tmp >> 4) & 0x3F]
    output += lookup[(tmp << 2) & 0x3F]
    output += '='
  }

  parts.push(output)

  return parts.join('')
}

},{}],20:[function(require,module,exports){
/*!
 * The buffer module from node.js, for the browser.
 *
 * @author   Feross Aboukhadijeh <https://feross.org>
 * @license  MIT
 */
/* eslint-disable no-proto */

'use strict'

var base64 = require('base64-js')
var ieee754 = require('ieee754')

exports.Buffer = Buffer
exports.SlowBuffer = SlowBuffer
exports.INSPECT_MAX_BYTES = 50

var K_MAX_LENGTH = 0x7fffffff
exports.kMaxLength = K_MAX_LENGTH

/**
 * If `Buffer.TYPED_ARRAY_SUPPORT`:
 *   === true    Use Uint8Array implementation (fastest)
 *   === false   Print warning and recommend using `buffer` v4.x which has an Object
 *               implementation (most compatible, even IE6)
 *
 * Browsers that support typed arrays are IE 10+, Firefox 4+, Chrome 7+, Safari 5.1+,
 * Opera 11.6+, iOS 4.2+.
 *
 * We report that the browser does not support typed arrays if the are not subclassable
 * using __proto__. Firefox 4-29 lacks support for adding new properties to `Uint8Array`
 * (See: https://bugzilla.mozilla.org/show_bug.cgi?id=695438). IE 10 lacks support
 * for __proto__ and has a buggy typed array implementation.
 */
Buffer.TYPED_ARRAY_SUPPORT = typedArraySupport()

if (!Buffer.TYPED_ARRAY_SUPPORT && typeof console !== 'undefined' &&
    typeof console.error === 'function') {
  console.error(
    'This browser lacks typed array (Uint8Array) support which is required by ' +
    '`buffer` v5.x. Use `buffer` v4.x if you require old browser support.'
  )
}

function typedArraySupport () {
  // Can typed array instances can be augmented?
  try {
    var arr = new Uint8Array(1)
    arr.__proto__ = {__proto__: Uint8Array.prototype, foo: function () { return 42 }}
    return arr.foo() === 42
  } catch (e) {
    return false
  }
}

Object.defineProperty(Buffer.prototype, 'parent', {
  get: function () {
    if (!(this instanceof Buffer)) {
      return undefined
    }
    return this.buffer
  }
})

Object.defineProperty(Buffer.prototype, 'offset', {
  get: function () {
    if (!(this instanceof Buffer)) {
      return undefined
    }
    return this.byteOffset
  }
})

function createBuffer (length) {
  if (length > K_MAX_LENGTH) {
    throw new RangeError('Invalid typed array length')
  }
  // Return an augmented `Uint8Array` instance
  var buf = new Uint8Array(length)
  buf.__proto__ = Buffer.prototype
  return buf
}

/**
 * The Buffer constructor returns instances of `Uint8Array` that have their
 * prototype changed to `Buffer.prototype`. Furthermore, `Buffer` is a subclass of
 * `Uint8Array`, so the returned instances will have all the node `Buffer` methods
 * and the `Uint8Array` methods. Square bracket notation works as expected -- it
 * returns a single octet.
 *
 * The `Uint8Array` prototype remains unmodified.
 */

function Buffer (arg, encodingOrOffset, length) {
  // Common case.
  if (typeof arg === 'number') {
    if (typeof encodingOrOffset === 'string') {
      throw new Error(
        'If encoding is specified then the first argument must be a string'
      )
    }
    return allocUnsafe(arg)
  }
  return from(arg, encodingOrOffset, length)
}

// Fix subarray() in ES2016. See: https://github.com/feross/buffer/pull/97
if (typeof Symbol !== 'undefined' && Symbol.species &&
    Buffer[Symbol.species] === Buffer) {
  Object.defineProperty(Buffer, Symbol.species, {
    value: null,
    configurable: true,
    enumerable: false,
    writable: false
  })
}

Buffer.poolSize = 8192 // not used by this implementation

function from (value, encodingOrOffset, length) {
  if (typeof value === 'number') {
    throw new TypeError('"value" argument must not be a number')
  }

  if (isArrayBuffer(value) || (value && isArrayBuffer(value.buffer))) {
    return fromArrayBuffer(value, encodingOrOffset, length)
  }

  if (typeof value === 'string') {
    return fromString(value, encodingOrOffset)
  }

  return fromObject(value)
}

/**
 * Functionally equivalent to Buffer(arg, encoding) but throws a TypeError
 * if value is a number.
 * Buffer.from(str[, encoding])
 * Buffer.from(array)
 * Buffer.from(buffer)
 * Buffer.from(arrayBuffer[, byteOffset[, length]])
 **/
Buffer.from = function (value, encodingOrOffset, length) {
  return from(value, encodingOrOffset, length)
}

// Note: Change prototype *after* Buffer.from is defined to workaround Chrome bug:
// https://github.com/feross/buffer/pull/148
Buffer.prototype.__proto__ = Uint8Array.prototype
Buffer.__proto__ = Uint8Array

function assertSize (size) {
  if (typeof size !== 'number') {
    throw new TypeError('"size" argument must be of type number')
  } else if (size < 0) {
    throw new RangeError('"size" argument must not be negative')
  }
}

function alloc (size, fill, encoding) {
  assertSize(size)
  if (size <= 0) {
    return createBuffer(size)
  }
  if (fill !== undefined) {
    // Only pay attention to encoding if it's a string. This
    // prevents accidentally sending in a number that would
    // be interpretted as a start offset.
    return typeof encoding === 'string'
      ? createBuffer(size).fill(fill, encoding)
      : createBuffer(size).fill(fill)
  }
  return createBuffer(size)
}

/**
 * Creates a new filled Buffer instance.
 * alloc(size[, fill[, encoding]])
 **/
Buffer.alloc = function (size, fill, encoding) {
  return alloc(size, fill, encoding)
}

function allocUnsafe (size) {
  assertSize(size)
  return createBuffer(size < 0 ? 0 : checked(size) | 0)
}

/**
 * Equivalent to Buffer(num), by default creates a non-zero-filled Buffer instance.
 * */
Buffer.allocUnsafe = function (size) {
  return allocUnsafe(size)
}
/**
 * Equivalent to SlowBuffer(num), by default creates a non-zero-filled Buffer instance.
 */
Buffer.allocUnsafeSlow = function (size) {
  return allocUnsafe(size)
}

function fromString (string, encoding) {
  if (typeof encoding !== 'string' || encoding === '') {
    encoding = 'utf8'
  }

  if (!Buffer.isEncoding(encoding)) {
    throw new TypeError('Unknown encoding: ' + encoding)
  }

  var length = byteLength(string, encoding) | 0
  var buf = createBuffer(length)

  var actual = buf.write(string, encoding)

  if (actual !== length) {
    // Writing a hex string, for example, that contains invalid characters will
    // cause everything after the first invalid character to be ignored. (e.g.
    // 'abxxcd' will be treated as 'ab')
    buf = buf.slice(0, actual)
  }

  return buf
}

function fromArrayLike (array) {
  var length = array.length < 0 ? 0 : checked(array.length) | 0
  var buf = createBuffer(length)
  for (var i = 0; i < length; i += 1) {
    buf[i] = array[i] & 255
  }
  return buf
}

function fromArrayBuffer (array, byteOffset, length) {
  if (byteOffset < 0 || array.byteLength < byteOffset) {
    throw new RangeError('"offset" is outside of buffer bounds')
  }

  if (array.byteLength < byteOffset + (length || 0)) {
    throw new RangeError('"length" is outside of buffer bounds')
  }

  var buf
  if (byteOffset === undefined && length === undefined) {
    buf = new Uint8Array(array)
  } else if (length === undefined) {
    buf = new Uint8Array(array, byteOffset)
  } else {
    buf = new Uint8Array(array, byteOffset, length)
  }

  // Return an augmented `Uint8Array` instance
  buf.__proto__ = Buffer.prototype
  return buf
}

function fromObject (obj) {
  if (Buffer.isBuffer(obj)) {
    var len = checked(obj.length) | 0
    var buf = createBuffer(len)

    if (buf.length === 0) {
      return buf
    }

    obj.copy(buf, 0, 0, len)
    return buf
  }

  if (obj) {
    if (ArrayBuffer.isView(obj) || 'length' in obj) {
      if (typeof obj.length !== 'number' || numberIsNaN(obj.length)) {
        return createBuffer(0)
      }
      return fromArrayLike(obj)
    }

    if (obj.type === 'Buffer' && Array.isArray(obj.data)) {
      return fromArrayLike(obj.data)
    }
  }

  throw new TypeError('The first argument must be one of type string, Buffer, ArrayBuffer, Array, or Array-like Object.')
}

function checked (length) {
  // Note: cannot use `length < K_MAX_LENGTH` here because that fails when
  // length is NaN (which is otherwise coerced to zero.)
  if (length >= K_MAX_LENGTH) {
    throw new RangeError('Attempt to allocate Buffer larger than maximum ' +
                         'size: 0x' + K_MAX_LENGTH.toString(16) + ' bytes')
  }
  return length | 0
}

function SlowBuffer (length) {
  if (+length != length) { // eslint-disable-line eqeqeq
    length = 0
  }
  return Buffer.alloc(+length)
}

Buffer.isBuffer = function isBuffer (b) {
  return b != null && b._isBuffer === true
}

Buffer.compare = function compare (a, b) {
  if (!Buffer.isBuffer(a) || !Buffer.isBuffer(b)) {
    throw new TypeError('Arguments must be Buffers')
  }

  if (a === b) return 0

  var x = a.length
  var y = b.length

  for (var i = 0, len = Math.min(x, y); i < len; ++i) {
    if (a[i] !== b[i]) {
      x = a[i]
      y = b[i]
      break
    }
  }

  if (x < y) return -1
  if (y < x) return 1
  return 0
}

Buffer.isEncoding = function isEncoding (encoding) {
  switch (String(encoding).toLowerCase()) {
    case 'hex':
    case 'utf8':
    case 'utf-8':
    case 'ascii':
    case 'latin1':
    case 'binary':
    case 'base64':
    case 'ucs2':
    case 'ucs-2':
    case 'utf16le':
    case 'utf-16le':
      return true
    default:
      return false
  }
}

Buffer.concat = function concat (list, length) {
  if (!Array.isArray(list)) {
    throw new TypeError('"list" argument must be an Array of Buffers')
  }

  if (list.length === 0) {
    return Buffer.alloc(0)
  }

  var i
  if (length === undefined) {
    length = 0
    for (i = 0; i < list.length; ++i) {
      length += list[i].length
    }
  }

  var buffer = Buffer.allocUnsafe(length)
  var pos = 0
  for (i = 0; i < list.length; ++i) {
    var buf = list[i]
    if (ArrayBuffer.isView(buf)) {
      buf = Buffer.from(buf)
    }
    if (!Buffer.isBuffer(buf)) {
      throw new TypeError('"list" argument must be an Array of Buffers')
    }
    buf.copy(buffer, pos)
    pos += buf.length
  }
  return buffer
}

function byteLength (string, encoding) {
  if (Buffer.isBuffer(string)) {
    return string.length
  }
  if (ArrayBuffer.isView(string) || isArrayBuffer(string)) {
    return string.byteLength
  }
  if (typeof string !== 'string') {
    string = '' + string
  }

  var len = string.length
  if (len === 0) return 0

  // Use a for loop to avoid recursion
  var loweredCase = false
  for (;;) {
    switch (encoding) {
      case 'ascii':
      case 'latin1':
      case 'binary':
        return len
      case 'utf8':
      case 'utf-8':
      case undefined:
        return utf8ToBytes(string).length
      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return len * 2
      case 'hex':
        return len >>> 1
      case 'base64':
        return base64ToBytes(string).length
      default:
        if (loweredCase) return utf8ToBytes(string).length // assume utf8
        encoding = ('' + encoding).toLowerCase()
        loweredCase = true
    }
  }
}
Buffer.byteLength = byteLength

function slowToString (encoding, start, end) {
  var loweredCase = false

  // No need to verify that "this.length <= MAX_UINT32" since it's a read-only
  // property of a typed array.

  // This behaves neither like String nor Uint8Array in that we set start/end
  // to their upper/lower bounds if the value passed is out of range.
  // undefined is handled specially as per ECMA-262 6th Edition,
  // Section 13.3.3.7 Runtime Semantics: KeyedBindingInitialization.
  if (start === undefined || start < 0) {
    start = 0
  }
  // Return early if start > this.length. Done here to prevent potential uint32
  // coercion fail below.
  if (start > this.length) {
    return ''
  }

  if (end === undefined || end > this.length) {
    end = this.length
  }

  if (end <= 0) {
    return ''
  }

  // Force coersion to uint32. This will also coerce falsey/NaN values to 0.
  end >>>= 0
  start >>>= 0

  if (end <= start) {
    return ''
  }

  if (!encoding) encoding = 'utf8'

  while (true) {
    switch (encoding) {
      case 'hex':
        return hexSlice(this, start, end)

      case 'utf8':
      case 'utf-8':
        return utf8Slice(this, start, end)

      case 'ascii':
        return asciiSlice(this, start, end)

      case 'latin1':
      case 'binary':
        return latin1Slice(this, start, end)

      case 'base64':
        return base64Slice(this, start, end)

      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return utf16leSlice(this, start, end)

      default:
        if (loweredCase) throw new TypeError('Unknown encoding: ' + encoding)
        encoding = (encoding + '').toLowerCase()
        loweredCase = true
    }
  }
}

// This property is used by `Buffer.isBuffer` (and the `is-buffer` npm package)
// to detect a Buffer instance. It's not possible to use `instanceof Buffer`
// reliably in a browserify context because there could be multiple different
// copies of the 'buffer' package in use. This method works even for Buffer
// instances that were created from another copy of the `buffer` package.
// See: https://github.com/feross/buffer/issues/154
Buffer.prototype._isBuffer = true

function swap (b, n, m) {
  var i = b[n]
  b[n] = b[m]
  b[m] = i
}

Buffer.prototype.swap16 = function swap16 () {
  var len = this.length
  if (len % 2 !== 0) {
    throw new RangeError('Buffer size must be a multiple of 16-bits')
  }
  for (var i = 0; i < len; i += 2) {
    swap(this, i, i + 1)
  }
  return this
}

Buffer.prototype.swap32 = function swap32 () {
  var len = this.length
  if (len % 4 !== 0) {
    throw new RangeError('Buffer size must be a multiple of 32-bits')
  }
  for (var i = 0; i < len; i += 4) {
    swap(this, i, i + 3)
    swap(this, i + 1, i + 2)
  }
  return this
}

Buffer.prototype.swap64 = function swap64 () {
  var len = this.length
  if (len % 8 !== 0) {
    throw new RangeError('Buffer size must be a multiple of 64-bits')
  }
  for (var i = 0; i < len; i += 8) {
    swap(this, i, i + 7)
    swap(this, i + 1, i + 6)
    swap(this, i + 2, i + 5)
    swap(this, i + 3, i + 4)
  }
  return this
}

Buffer.prototype.toString = function toString () {
  var length = this.length
  if (length === 0) return ''
  if (arguments.length === 0) return utf8Slice(this, 0, length)
  return slowToString.apply(this, arguments)
}

Buffer.prototype.toLocaleString = Buffer.prototype.toString

Buffer.prototype.equals = function equals (b) {
  if (!Buffer.isBuffer(b)) throw new TypeError('Argument must be a Buffer')
  if (this === b) return true
  return Buffer.compare(this, b) === 0
}

Buffer.prototype.inspect = function inspect () {
  var str = ''
  var max = exports.INSPECT_MAX_BYTES
  if (this.length > 0) {
    str = this.toString('hex', 0, max).match(/.{2}/g).join(' ')
    if (this.length > max) str += ' ... '
  }
  return '<Buffer ' + str + '>'
}

Buffer.prototype.compare = function compare (target, start, end, thisStart, thisEnd) {
  if (!Buffer.isBuffer(target)) {
    throw new TypeError('Argument must be a Buffer')
  }

  if (start === undefined) {
    start = 0
  }
  if (end === undefined) {
    end = target ? target.length : 0
  }
  if (thisStart === undefined) {
    thisStart = 0
  }
  if (thisEnd === undefined) {
    thisEnd = this.length
  }

  if (start < 0 || end > target.length || thisStart < 0 || thisEnd > this.length) {
    throw new RangeError('out of range index')
  }

  if (thisStart >= thisEnd && start >= end) {
    return 0
  }
  if (thisStart >= thisEnd) {
    return -1
  }
  if (start >= end) {
    return 1
  }

  start >>>= 0
  end >>>= 0
  thisStart >>>= 0
  thisEnd >>>= 0

  if (this === target) return 0

  var x = thisEnd - thisStart
  var y = end - start
  var len = Math.min(x, y)

  var thisCopy = this.slice(thisStart, thisEnd)
  var targetCopy = target.slice(start, end)

  for (var i = 0; i < len; ++i) {
    if (thisCopy[i] !== targetCopy[i]) {
      x = thisCopy[i]
      y = targetCopy[i]
      break
    }
  }

  if (x < y) return -1
  if (y < x) return 1
  return 0
}

// Finds either the first index of `val` in `buffer` at offset >= `byteOffset`,
// OR the last index of `val` in `buffer` at offset <= `byteOffset`.
//
// Arguments:
// - buffer - a Buffer to search
// - val - a string, Buffer, or number
// - byteOffset - an index into `buffer`; will be clamped to an int32
// - encoding - an optional encoding, relevant is val is a string
// - dir - true for indexOf, false for lastIndexOf
function bidirectionalIndexOf (buffer, val, byteOffset, encoding, dir) {
  // Empty buffer means no match
  if (buffer.length === 0) return -1

  // Normalize byteOffset
  if (typeof byteOffset === 'string') {
    encoding = byteOffset
    byteOffset = 0
  } else if (byteOffset > 0x7fffffff) {
    byteOffset = 0x7fffffff
  } else if (byteOffset < -0x80000000) {
    byteOffset = -0x80000000
  }
  byteOffset = +byteOffset  // Coerce to Number.
  if (numberIsNaN(byteOffset)) {
    // byteOffset: it it's undefined, null, NaN, "foo", etc, search whole buffer
    byteOffset = dir ? 0 : (buffer.length - 1)
  }

  // Normalize byteOffset: negative offsets start from the end of the buffer
  if (byteOffset < 0) byteOffset = buffer.length + byteOffset
  if (byteOffset >= buffer.length) {
    if (dir) return -1
    else byteOffset = buffer.length - 1
  } else if (byteOffset < 0) {
    if (dir) byteOffset = 0
    else return -1
  }

  // Normalize val
  if (typeof val === 'string') {
    val = Buffer.from(val, encoding)
  }

  // Finally, search either indexOf (if dir is true) or lastIndexOf
  if (Buffer.isBuffer(val)) {
    // Special case: looking for empty string/buffer always fails
    if (val.length === 0) {
      return -1
    }
    return arrayIndexOf(buffer, val, byteOffset, encoding, dir)
  } else if (typeof val === 'number') {
    val = val & 0xFF // Search for a byte value [0-255]
    if (typeof Uint8Array.prototype.indexOf === 'function') {
      if (dir) {
        return Uint8Array.prototype.indexOf.call(buffer, val, byteOffset)
      } else {
        return Uint8Array.prototype.lastIndexOf.call(buffer, val, byteOffset)
      }
    }
    return arrayIndexOf(buffer, [ val ], byteOffset, encoding, dir)
  }

  throw new TypeError('val must be string, number or Buffer')
}

function arrayIndexOf (arr, val, byteOffset, encoding, dir) {
  var indexSize = 1
  var arrLength = arr.length
  var valLength = val.length

  if (encoding !== undefined) {
    encoding = String(encoding).toLowerCase()
    if (encoding === 'ucs2' || encoding === 'ucs-2' ||
        encoding === 'utf16le' || encoding === 'utf-16le') {
      if (arr.length < 2 || val.length < 2) {
        return -1
      }
      indexSize = 2
      arrLength /= 2
      valLength /= 2
      byteOffset /= 2
    }
  }

  function read (buf, i) {
    if (indexSize === 1) {
      return buf[i]
    } else {
      return buf.readUInt16BE(i * indexSize)
    }
  }

  var i
  if (dir) {
    var foundIndex = -1
    for (i = byteOffset; i < arrLength; i++) {
      if (read(arr, i) === read(val, foundIndex === -1 ? 0 : i - foundIndex)) {
        if (foundIndex === -1) foundIndex = i
        if (i - foundIndex + 1 === valLength) return foundIndex * indexSize
      } else {
        if (foundIndex !== -1) i -= i - foundIndex
        foundIndex = -1
      }
    }
  } else {
    if (byteOffset + valLength > arrLength) byteOffset = arrLength - valLength
    for (i = byteOffset; i >= 0; i--) {
      var found = true
      for (var j = 0; j < valLength; j++) {
        if (read(arr, i + j) !== read(val, j)) {
          found = false
          break
        }
      }
      if (found) return i
    }
  }

  return -1
}

Buffer.prototype.includes = function includes (val, byteOffset, encoding) {
  return this.indexOf(val, byteOffset, encoding) !== -1
}

Buffer.prototype.indexOf = function indexOf (val, byteOffset, encoding) {
  return bidirectionalIndexOf(this, val, byteOffset, encoding, true)
}

Buffer.prototype.lastIndexOf = function lastIndexOf (val, byteOffset, encoding) {
  return bidirectionalIndexOf(this, val, byteOffset, encoding, false)
}

function hexWrite (buf, string, offset, length) {
  offset = Number(offset) || 0
  var remaining = buf.length - offset
  if (!length) {
    length = remaining
  } else {
    length = Number(length)
    if (length > remaining) {
      length = remaining
    }
  }

  var strLen = string.length

  if (length > strLen / 2) {
    length = strLen / 2
  }
  for (var i = 0; i < length; ++i) {
    var parsed = parseInt(string.substr(i * 2, 2), 16)
    if (numberIsNaN(parsed)) return i
    buf[offset + i] = parsed
  }
  return i
}

function utf8Write (buf, string, offset, length) {
  return blitBuffer(utf8ToBytes(string, buf.length - offset), buf, offset, length)
}

function asciiWrite (buf, string, offset, length) {
  return blitBuffer(asciiToBytes(string), buf, offset, length)
}

function latin1Write (buf, string, offset, length) {
  return asciiWrite(buf, string, offset, length)
}

function base64Write (buf, string, offset, length) {
  return blitBuffer(base64ToBytes(string), buf, offset, length)
}

function ucs2Write (buf, string, offset, length) {
  return blitBuffer(utf16leToBytes(string, buf.length - offset), buf, offset, length)
}

Buffer.prototype.write = function write (string, offset, length, encoding) {
  // Buffer#write(string)
  if (offset === undefined) {
    encoding = 'utf8'
    length = this.length
    offset = 0
  // Buffer#write(string, encoding)
  } else if (length === undefined && typeof offset === 'string') {
    encoding = offset
    length = this.length
    offset = 0
  // Buffer#write(string, offset[, length][, encoding])
  } else if (isFinite(offset)) {
    offset = offset >>> 0
    if (isFinite(length)) {
      length = length >>> 0
      if (encoding === undefined) encoding = 'utf8'
    } else {
      encoding = length
      length = undefined
    }
  } else {
    throw new Error(
      'Buffer.write(string, encoding, offset[, length]) is no longer supported'
    )
  }

  var remaining = this.length - offset
  if (length === undefined || length > remaining) length = remaining

  if ((string.length > 0 && (length < 0 || offset < 0)) || offset > this.length) {
    throw new RangeError('Attempt to write outside buffer bounds')
  }

  if (!encoding) encoding = 'utf8'

  var loweredCase = false
  for (;;) {
    switch (encoding) {
      case 'hex':
        return hexWrite(this, string, offset, length)

      case 'utf8':
      case 'utf-8':
        return utf8Write(this, string, offset, length)

      case 'ascii':
        return asciiWrite(this, string, offset, length)

      case 'latin1':
      case 'binary':
        return latin1Write(this, string, offset, length)

      case 'base64':
        // Warning: maxLength not taken into account in base64Write
        return base64Write(this, string, offset, length)

      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return ucs2Write(this, string, offset, length)

      default:
        if (loweredCase) throw new TypeError('Unknown encoding: ' + encoding)
        encoding = ('' + encoding).toLowerCase()
        loweredCase = true
    }
  }
}

Buffer.prototype.toJSON = function toJSON () {
  return {
    type: 'Buffer',
    data: Array.prototype.slice.call(this._arr || this, 0)
  }
}

function base64Slice (buf, start, end) {
  if (start === 0 && end === buf.length) {
    return base64.fromByteArray(buf)
  } else {
    return base64.fromByteArray(buf.slice(start, end))
  }
}

function utf8Slice (buf, start, end) {
  end = Math.min(buf.length, end)
  var res = []

  var i = start
  while (i < end) {
    var firstByte = buf[i]
    var codePoint = null
    var bytesPerSequence = (firstByte > 0xEF) ? 4
      : (firstByte > 0xDF) ? 3
      : (firstByte > 0xBF) ? 2
      : 1

    if (i + bytesPerSequence <= end) {
      var secondByte, thirdByte, fourthByte, tempCodePoint

      switch (bytesPerSequence) {
        case 1:
          if (firstByte < 0x80) {
            codePoint = firstByte
          }
          break
        case 2:
          secondByte = buf[i + 1]
          if ((secondByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0x1F) << 0x6 | (secondByte & 0x3F)
            if (tempCodePoint > 0x7F) {
              codePoint = tempCodePoint
            }
          }
          break
        case 3:
          secondByte = buf[i + 1]
          thirdByte = buf[i + 2]
          if ((secondByte & 0xC0) === 0x80 && (thirdByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0xF) << 0xC | (secondByte & 0x3F) << 0x6 | (thirdByte & 0x3F)
            if (tempCodePoint > 0x7FF && (tempCodePoint < 0xD800 || tempCodePoint > 0xDFFF)) {
              codePoint = tempCodePoint
            }
          }
          break
        case 4:
          secondByte = buf[i + 1]
          thirdByte = buf[i + 2]
          fourthByte = buf[i + 3]
          if ((secondByte & 0xC0) === 0x80 && (thirdByte & 0xC0) === 0x80 && (fourthByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0xF) << 0x12 | (secondByte & 0x3F) << 0xC | (thirdByte & 0x3F) << 0x6 | (fourthByte & 0x3F)
            if (tempCodePoint > 0xFFFF && tempCodePoint < 0x110000) {
              codePoint = tempCodePoint
            }
          }
      }
    }

    if (codePoint === null) {
      // we did not generate a valid codePoint so insert a
      // replacement char (U+FFFD) and advance only 1 byte
      codePoint = 0xFFFD
      bytesPerSequence = 1
    } else if (codePoint > 0xFFFF) {
      // encode to utf16 (surrogate pair dance)
      codePoint -= 0x10000
      res.push(codePoint >>> 10 & 0x3FF | 0xD800)
      codePoint = 0xDC00 | codePoint & 0x3FF
    }

    res.push(codePoint)
    i += bytesPerSequence
  }

  return decodeCodePointsArray(res)
}

// Based on http://stackoverflow.com/a/22747272/680742, the browser with
// the lowest limit is Chrome, with 0x10000 args.
// We go 1 magnitude less, for safety
var MAX_ARGUMENTS_LENGTH = 0x1000

function decodeCodePointsArray (codePoints) {
  var len = codePoints.length
  if (len <= MAX_ARGUMENTS_LENGTH) {
    return String.fromCharCode.apply(String, codePoints) // avoid extra slice()
  }

  // Decode in chunks to avoid "call stack size exceeded".
  var res = ''
  var i = 0
  while (i < len) {
    res += String.fromCharCode.apply(
      String,
      codePoints.slice(i, i += MAX_ARGUMENTS_LENGTH)
    )
  }
  return res
}

function asciiSlice (buf, start, end) {
  var ret = ''
  end = Math.min(buf.length, end)

  for (var i = start; i < end; ++i) {
    ret += String.fromCharCode(buf[i] & 0x7F)
  }
  return ret
}

function latin1Slice (buf, start, end) {
  var ret = ''
  end = Math.min(buf.length, end)

  for (var i = start; i < end; ++i) {
    ret += String.fromCharCode(buf[i])
  }
  return ret
}

function hexSlice (buf, start, end) {
  var len = buf.length

  if (!start || start < 0) start = 0
  if (!end || end < 0 || end > len) end = len

  var out = ''
  for (var i = start; i < end; ++i) {
    out += toHex(buf[i])
  }
  return out
}

function utf16leSlice (buf, start, end) {
  var bytes = buf.slice(start, end)
  var res = ''
  for (var i = 0; i < bytes.length; i += 2) {
    res += String.fromCharCode(bytes[i] + (bytes[i + 1] * 256))
  }
  return res
}

Buffer.prototype.slice = function slice (start, end) {
  var len = this.length
  start = ~~start
  end = end === undefined ? len : ~~end

  if (start < 0) {
    start += len
    if (start < 0) start = 0
  } else if (start > len) {
    start = len
  }

  if (end < 0) {
    end += len
    if (end < 0) end = 0
  } else if (end > len) {
    end = len
  }

  if (end < start) end = start

  var newBuf = this.subarray(start, end)
  // Return an augmented `Uint8Array` instance
  newBuf.__proto__ = Buffer.prototype
  return newBuf
}

/*
 * Need to make sure that buffer isn't trying to write out of bounds.
 */
function checkOffset (offset, ext, length) {
  if ((offset % 1) !== 0 || offset < 0) throw new RangeError('offset is not uint')
  if (offset + ext > length) throw new RangeError('Trying to access beyond buffer length')
}

Buffer.prototype.readUIntLE = function readUIntLE (offset, byteLength, noAssert) {
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) checkOffset(offset, byteLength, this.length)

  var val = this[offset]
  var mul = 1
  var i = 0
  while (++i < byteLength && (mul *= 0x100)) {
    val += this[offset + i] * mul
  }

  return val
}

Buffer.prototype.readUIntBE = function readUIntBE (offset, byteLength, noAssert) {
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) {
    checkOffset(offset, byteLength, this.length)
  }

  var val = this[offset + --byteLength]
  var mul = 1
  while (byteLength > 0 && (mul *= 0x100)) {
    val += this[offset + --byteLength] * mul
  }

  return val
}

Buffer.prototype.readUInt8 = function readUInt8 (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 1, this.length)
  return this[offset]
}

Buffer.prototype.readUInt16LE = function readUInt16LE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 2, this.length)
  return this[offset] | (this[offset + 1] << 8)
}

Buffer.prototype.readUInt16BE = function readUInt16BE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 2, this.length)
  return (this[offset] << 8) | this[offset + 1]
}

Buffer.prototype.readUInt32LE = function readUInt32LE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)

  return ((this[offset]) |
      (this[offset + 1] << 8) |
      (this[offset + 2] << 16)) +
      (this[offset + 3] * 0x1000000)
}

Buffer.prototype.readUInt32BE = function readUInt32BE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)

  return (this[offset] * 0x1000000) +
    ((this[offset + 1] << 16) |
    (this[offset + 2] << 8) |
    this[offset + 3])
}

Buffer.prototype.readIntLE = function readIntLE (offset, byteLength, noAssert) {
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) checkOffset(offset, byteLength, this.length)

  var val = this[offset]
  var mul = 1
  var i = 0
  while (++i < byteLength && (mul *= 0x100)) {
    val += this[offset + i] * mul
  }
  mul *= 0x80

  if (val >= mul) val -= Math.pow(2, 8 * byteLength)

  return val
}

Buffer.prototype.readIntBE = function readIntBE (offset, byteLength, noAssert) {
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) checkOffset(offset, byteLength, this.length)

  var i = byteLength
  var mul = 1
  var val = this[offset + --i]
  while (i > 0 && (mul *= 0x100)) {
    val += this[offset + --i] * mul
  }
  mul *= 0x80

  if (val >= mul) val -= Math.pow(2, 8 * byteLength)

  return val
}

Buffer.prototype.readInt8 = function readInt8 (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 1, this.length)
  if (!(this[offset] & 0x80)) return (this[offset])
  return ((0xff - this[offset] + 1) * -1)
}

Buffer.prototype.readInt16LE = function readInt16LE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 2, this.length)
  var val = this[offset] | (this[offset + 1] << 8)
  return (val & 0x8000) ? val | 0xFFFF0000 : val
}

Buffer.prototype.readInt16BE = function readInt16BE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 2, this.length)
  var val = this[offset + 1] | (this[offset] << 8)
  return (val & 0x8000) ? val | 0xFFFF0000 : val
}

Buffer.prototype.readInt32LE = function readInt32LE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)

  return (this[offset]) |
    (this[offset + 1] << 8) |
    (this[offset + 2] << 16) |
    (this[offset + 3] << 24)
}

Buffer.prototype.readInt32BE = function readInt32BE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)

  return (this[offset] << 24) |
    (this[offset + 1] << 16) |
    (this[offset + 2] << 8) |
    (this[offset + 3])
}

Buffer.prototype.readFloatLE = function readFloatLE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)
  return ieee754.read(this, offset, true, 23, 4)
}

Buffer.prototype.readFloatBE = function readFloatBE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)
  return ieee754.read(this, offset, false, 23, 4)
}

Buffer.prototype.readDoubleLE = function readDoubleLE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 8, this.length)
  return ieee754.read(this, offset, true, 52, 8)
}

Buffer.prototype.readDoubleBE = function readDoubleBE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 8, this.length)
  return ieee754.read(this, offset, false, 52, 8)
}

function checkInt (buf, value, offset, ext, max, min) {
  if (!Buffer.isBuffer(buf)) throw new TypeError('"buffer" argument must be a Buffer instance')
  if (value > max || value < min) throw new RangeError('"value" argument is out of bounds')
  if (offset + ext > buf.length) throw new RangeError('Index out of range')
}

Buffer.prototype.writeUIntLE = function writeUIntLE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) {
    var maxBytes = Math.pow(2, 8 * byteLength) - 1
    checkInt(this, value, offset, byteLength, maxBytes, 0)
  }

  var mul = 1
  var i = 0
  this[offset] = value & 0xFF
  while (++i < byteLength && (mul *= 0x100)) {
    this[offset + i] = (value / mul) & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeUIntBE = function writeUIntBE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) {
    var maxBytes = Math.pow(2, 8 * byteLength) - 1
    checkInt(this, value, offset, byteLength, maxBytes, 0)
  }

  var i = byteLength - 1
  var mul = 1
  this[offset + i] = value & 0xFF
  while (--i >= 0 && (mul *= 0x100)) {
    this[offset + i] = (value / mul) & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeUInt8 = function writeUInt8 (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 1, 0xff, 0)
  this[offset] = (value & 0xff)
  return offset + 1
}

Buffer.prototype.writeUInt16LE = function writeUInt16LE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 2, 0xffff, 0)
  this[offset] = (value & 0xff)
  this[offset + 1] = (value >>> 8)
  return offset + 2
}

Buffer.prototype.writeUInt16BE = function writeUInt16BE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 2, 0xffff, 0)
  this[offset] = (value >>> 8)
  this[offset + 1] = (value & 0xff)
  return offset + 2
}

Buffer.prototype.writeUInt32LE = function writeUInt32LE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 4, 0xffffffff, 0)
  this[offset + 3] = (value >>> 24)
  this[offset + 2] = (value >>> 16)
  this[offset + 1] = (value >>> 8)
  this[offset] = (value & 0xff)
  return offset + 4
}

Buffer.prototype.writeUInt32BE = function writeUInt32BE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 4, 0xffffffff, 0)
  this[offset] = (value >>> 24)
  this[offset + 1] = (value >>> 16)
  this[offset + 2] = (value >>> 8)
  this[offset + 3] = (value & 0xff)
  return offset + 4
}

Buffer.prototype.writeIntLE = function writeIntLE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) {
    var limit = Math.pow(2, (8 * byteLength) - 1)

    checkInt(this, value, offset, byteLength, limit - 1, -limit)
  }

  var i = 0
  var mul = 1
  var sub = 0
  this[offset] = value & 0xFF
  while (++i < byteLength && (mul *= 0x100)) {
    if (value < 0 && sub === 0 && this[offset + i - 1] !== 0) {
      sub = 1
    }
    this[offset + i] = ((value / mul) >> 0) - sub & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeIntBE = function writeIntBE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) {
    var limit = Math.pow(2, (8 * byteLength) - 1)

    checkInt(this, value, offset, byteLength, limit - 1, -limit)
  }

  var i = byteLength - 1
  var mul = 1
  var sub = 0
  this[offset + i] = value & 0xFF
  while (--i >= 0 && (mul *= 0x100)) {
    if (value < 0 && sub === 0 && this[offset + i + 1] !== 0) {
      sub = 1
    }
    this[offset + i] = ((value / mul) >> 0) - sub & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeInt8 = function writeInt8 (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 1, 0x7f, -0x80)
  if (value < 0) value = 0xff + value + 1
  this[offset] = (value & 0xff)
  return offset + 1
}

Buffer.prototype.writeInt16LE = function writeInt16LE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 2, 0x7fff, -0x8000)
  this[offset] = (value & 0xff)
  this[offset + 1] = (value >>> 8)
  return offset + 2
}

Buffer.prototype.writeInt16BE = function writeInt16BE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 2, 0x7fff, -0x8000)
  this[offset] = (value >>> 8)
  this[offset + 1] = (value & 0xff)
  return offset + 2
}

Buffer.prototype.writeInt32LE = function writeInt32LE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000)
  this[offset] = (value & 0xff)
  this[offset + 1] = (value >>> 8)
  this[offset + 2] = (value >>> 16)
  this[offset + 3] = (value >>> 24)
  return offset + 4
}

Buffer.prototype.writeInt32BE = function writeInt32BE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000)
  if (value < 0) value = 0xffffffff + value + 1
  this[offset] = (value >>> 24)
  this[offset + 1] = (value >>> 16)
  this[offset + 2] = (value >>> 8)
  this[offset + 3] = (value & 0xff)
  return offset + 4
}

function checkIEEE754 (buf, value, offset, ext, max, min) {
  if (offset + ext > buf.length) throw new RangeError('Index out of range')
  if (offset < 0) throw new RangeError('Index out of range')
}

function writeFloat (buf, value, offset, littleEndian, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) {
    checkIEEE754(buf, value, offset, 4, 3.4028234663852886e+38, -3.4028234663852886e+38)
  }
  ieee754.write(buf, value, offset, littleEndian, 23, 4)
  return offset + 4
}

Buffer.prototype.writeFloatLE = function writeFloatLE (value, offset, noAssert) {
  return writeFloat(this, value, offset, true, noAssert)
}

Buffer.prototype.writeFloatBE = function writeFloatBE (value, offset, noAssert) {
  return writeFloat(this, value, offset, false, noAssert)
}

function writeDouble (buf, value, offset, littleEndian, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) {
    checkIEEE754(buf, value, offset, 8, 1.7976931348623157E+308, -1.7976931348623157E+308)
  }
  ieee754.write(buf, value, offset, littleEndian, 52, 8)
  return offset + 8
}

Buffer.prototype.writeDoubleLE = function writeDoubleLE (value, offset, noAssert) {
  return writeDouble(this, value, offset, true, noAssert)
}

Buffer.prototype.writeDoubleBE = function writeDoubleBE (value, offset, noAssert) {
  return writeDouble(this, value, offset, false, noAssert)
}

// copy(targetBuffer, targetStart=0, sourceStart=0, sourceEnd=buffer.length)
Buffer.prototype.copy = function copy (target, targetStart, start, end) {
  if (!Buffer.isBuffer(target)) throw new TypeError('argument should be a Buffer')
  if (!start) start = 0
  if (!end && end !== 0) end = this.length
  if (targetStart >= target.length) targetStart = target.length
  if (!targetStart) targetStart = 0
  if (end > 0 && end < start) end = start

  // Copy 0 bytes; we're done
  if (end === start) return 0
  if (target.length === 0 || this.length === 0) return 0

  // Fatal error conditions
  if (targetStart < 0) {
    throw new RangeError('targetStart out of bounds')
  }
  if (start < 0 || start >= this.length) throw new RangeError('Index out of range')
  if (end < 0) throw new RangeError('sourceEnd out of bounds')

  // Are we oob?
  if (end > this.length) end = this.length
  if (target.length - targetStart < end - start) {
    end = target.length - targetStart + start
  }

  var len = end - start

  if (this === target && typeof Uint8Array.prototype.copyWithin === 'function') {
    // Use built-in when available, missing from IE11
    this.copyWithin(targetStart, start, end)
  } else if (this === target && start < targetStart && targetStart < end) {
    // descending copy from end
    for (var i = len - 1; i >= 0; --i) {
      target[i + targetStart] = this[i + start]
    }
  } else {
    Uint8Array.prototype.set.call(
      target,
      this.subarray(start, end),
      targetStart
    )
  }

  return len
}

// Usage:
//    buffer.fill(number[, offset[, end]])
//    buffer.fill(buffer[, offset[, end]])
//    buffer.fill(string[, offset[, end]][, encoding])
Buffer.prototype.fill = function fill (val, start, end, encoding) {
  // Handle string cases:
  if (typeof val === 'string') {
    if (typeof start === 'string') {
      encoding = start
      start = 0
      end = this.length
    } else if (typeof end === 'string') {
      encoding = end
      end = this.length
    }
    if (encoding !== undefined && typeof encoding !== 'string') {
      throw new TypeError('encoding must be a string')
    }
    if (typeof encoding === 'string' && !Buffer.isEncoding(encoding)) {
      throw new TypeError('Unknown encoding: ' + encoding)
    }
    if (val.length === 1) {
      var code = val.charCodeAt(0)
      if ((encoding === 'utf8' && code < 128) ||
          encoding === 'latin1') {
        // Fast path: If `val` fits into a single byte, use that numeric value.
        val = code
      }
    }
  } else if (typeof val === 'number') {
    val = val & 255
  }

  // Invalid ranges are not set to a default, so can range check early.
  if (start < 0 || this.length < start || this.length < end) {
    throw new RangeError('Out of range index')
  }

  if (end <= start) {
    return this
  }

  start = start >>> 0
  end = end === undefined ? this.length : end >>> 0

  if (!val) val = 0

  var i
  if (typeof val === 'number') {
    for (i = start; i < end; ++i) {
      this[i] = val
    }
  } else {
    var bytes = Buffer.isBuffer(val)
      ? val
      : new Buffer(val, encoding)
    var len = bytes.length
    if (len === 0) {
      throw new TypeError('The value "' + val +
        '" is invalid for argument "value"')
    }
    for (i = 0; i < end - start; ++i) {
      this[i + start] = bytes[i % len]
    }
  }

  return this
}

// HELPER FUNCTIONS
// ================

var INVALID_BASE64_RE = /[^+/0-9A-Za-z-_]/g

function base64clean (str) {
  // Node takes equal signs as end of the Base64 encoding
  str = str.split('=')[0]
  // Node strips out invalid characters like \n and \t from the string, base64-js does not
  str = str.trim().replace(INVALID_BASE64_RE, '')
  // Node converts strings with length < 2 to ''
  if (str.length < 2) return ''
  // Node allows for non-padded base64 strings (missing trailing ===), base64-js does not
  while (str.length % 4 !== 0) {
    str = str + '='
  }
  return str
}

function toHex (n) {
  if (n < 16) return '0' + n.toString(16)
  return n.toString(16)
}

function utf8ToBytes (string, units) {
  units = units || Infinity
  var codePoint
  var length = string.length
  var leadSurrogate = null
  var bytes = []

  for (var i = 0; i < length; ++i) {
    codePoint = string.charCodeAt(i)

    // is surrogate component
    if (codePoint > 0xD7FF && codePoint < 0xE000) {
      // last char was a lead
      if (!leadSurrogate) {
        // no lead yet
        if (codePoint > 0xDBFF) {
          // unexpected trail
          if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
          continue
        } else if (i + 1 === length) {
          // unpaired lead
          if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
          continue
        }

        // valid lead
        leadSurrogate = codePoint

        continue
      }

      // 2 leads in a row
      if (codePoint < 0xDC00) {
        if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
        leadSurrogate = codePoint
        continue
      }

      // valid surrogate pair
      codePoint = (leadSurrogate - 0xD800 << 10 | codePoint - 0xDC00) + 0x10000
    } else if (leadSurrogate) {
      // valid bmp char, but last char was a lead
      if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
    }

    leadSurrogate = null

    // encode utf8
    if (codePoint < 0x80) {
      if ((units -= 1) < 0) break
      bytes.push(codePoint)
    } else if (codePoint < 0x800) {
      if ((units -= 2) < 0) break
      bytes.push(
        codePoint >> 0x6 | 0xC0,
        codePoint & 0x3F | 0x80
      )
    } else if (codePoint < 0x10000) {
      if ((units -= 3) < 0) break
      bytes.push(
        codePoint >> 0xC | 0xE0,
        codePoint >> 0x6 & 0x3F | 0x80,
        codePoint & 0x3F | 0x80
      )
    } else if (codePoint < 0x110000) {
      if ((units -= 4) < 0) break
      bytes.push(
        codePoint >> 0x12 | 0xF0,
        codePoint >> 0xC & 0x3F | 0x80,
        codePoint >> 0x6 & 0x3F | 0x80,
        codePoint & 0x3F | 0x80
      )
    } else {
      throw new Error('Invalid code point')
    }
  }

  return bytes
}

function asciiToBytes (str) {
  var byteArray = []
  for (var i = 0; i < str.length; ++i) {
    // Node's code seems to be doing this and not & 0x7F..
    byteArray.push(str.charCodeAt(i) & 0xFF)
  }
  return byteArray
}

function utf16leToBytes (str, units) {
  var c, hi, lo
  var byteArray = []
  for (var i = 0; i < str.length; ++i) {
    if ((units -= 2) < 0) break

    c = str.charCodeAt(i)
    hi = c >> 8
    lo = c % 256
    byteArray.push(lo)
    byteArray.push(hi)
  }

  return byteArray
}

function base64ToBytes (str) {
  return base64.toByteArray(base64clean(str))
}

function blitBuffer (src, dst, offset, length) {
  for (var i = 0; i < length; ++i) {
    if ((i + offset >= dst.length) || (i >= src.length)) break
    dst[i + offset] = src[i]
  }
  return i
}

// ArrayBuffers from another context (i.e. an iframe) do not pass the `instanceof` check
// but they should be treated as valid. See: https://github.com/feross/buffer/issues/166
function isArrayBuffer (obj) {
  return obj instanceof ArrayBuffer ||
    (obj != null && obj.constructor != null && obj.constructor.name === 'ArrayBuffer' &&
      typeof obj.byteLength === 'number')
}

function numberIsNaN (obj) {
  return obj !== obj // eslint-disable-line no-self-compare
}

},{"base64-js":19,"ieee754":21}],21:[function(require,module,exports){
exports.read = function (buffer, offset, isLE, mLen, nBytes) {
  var e, m
  var eLen = (nBytes * 8) - mLen - 1
  var eMax = (1 << eLen) - 1
  var eBias = eMax >> 1
  var nBits = -7
  var i = isLE ? (nBytes - 1) : 0
  var d = isLE ? -1 : 1
  var s = buffer[offset + i]

  i += d

  e = s & ((1 << (-nBits)) - 1)
  s >>= (-nBits)
  nBits += eLen
  for (; nBits > 0; e = (e * 256) + buffer[offset + i], i += d, nBits -= 8) {}

  m = e & ((1 << (-nBits)) - 1)
  e >>= (-nBits)
  nBits += mLen
  for (; nBits > 0; m = (m * 256) + buffer[offset + i], i += d, nBits -= 8) {}

  if (e === 0) {
    e = 1 - eBias
  } else if (e === eMax) {
    return m ? NaN : ((s ? -1 : 1) * Infinity)
  } else {
    m = m + Math.pow(2, mLen)
    e = e - eBias
  }
  return (s ? -1 : 1) * m * Math.pow(2, e - mLen)
}

exports.write = function (buffer, value, offset, isLE, mLen, nBytes) {
  var e, m, c
  var eLen = (nBytes * 8) - mLen - 1
  var eMax = (1 << eLen) - 1
  var eBias = eMax >> 1
  var rt = (mLen === 23 ? Math.pow(2, -24) - Math.pow(2, -77) : 0)
  var i = isLE ? 0 : (nBytes - 1)
  var d = isLE ? 1 : -1
  var s = value < 0 || (value === 0 && 1 / value < 0) ? 1 : 0

  value = Math.abs(value)

  if (isNaN(value) || value === Infinity) {
    m = isNaN(value) ? 1 : 0
    e = eMax
  } else {
    e = Math.floor(Math.log(value) / Math.LN2)
    if (value * (c = Math.pow(2, -e)) < 1) {
      e--
      c *= 2
    }
    if (e + eBias >= 1) {
      value += rt / c
    } else {
      value += rt * Math.pow(2, 1 - eBias)
    }
    if (value * c >= 2) {
      e++
      c /= 2
    }

    if (e + eBias >= eMax) {
      m = 0
      e = eMax
    } else if (e + eBias >= 1) {
      m = ((value * c) - 1) * Math.pow(2, mLen)
      e = e + eBias
    } else {
      m = value * Math.pow(2, eBias - 1) * Math.pow(2, mLen)
      e = 0
    }
  }

  for (; mLen >= 8; buffer[offset + i] = m & 0xff, i += d, m /= 256, mLen -= 8) {}

  e = (e << mLen) | m
  eLen += mLen
  for (; eLen > 0; buffer[offset + i] = e & 0xff, i += d, e /= 256, eLen -= 8) {}

  buffer[offset + i - d] |= s * 128
}

},{}],22:[function(require,module,exports){
(function (global, factory) {
	typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
	typeof define === 'function' && define.amd ? define(factory) :
	(global.MemoryMap = factory());
}(this, (function () { 'use strict';

/**
 * Parser/writer for the "Intel hex" format.
 */

/*
 * A regexp that matches lines in a .hex file.
 *
 * One hexadecimal character is matched by "[0-9A-Fa-f]".
 * Two hex characters are matched by "[0-9A-Fa-f]{2}"
 * Eight or more hex characters are matched by "[0-9A-Fa-f]{8,}"
 * A capture group of two hex characters is "([0-9A-Fa-f]{2})"
 *
 * Record mark         :
 * 8 or more hex chars  ([0-9A-Fa-f]{8,})
 * Checksum                              ([0-9A-Fa-f]{2})
 * Optional newline                                      (?:\r\n|\r|\n|)
 */
var hexLineRegexp = /:([0-9A-Fa-f]{8,})([0-9A-Fa-f]{2})(?:\r\n|\r|\n|)/g;


// Takes a Uint8Array as input,
// Returns an integer in the 0-255 range.
function checksum(bytes) {
    return (-bytes.reduce(function (sum, v){ return sum + v; }, 0)) & 0xFF;
}

// Takes two Uint8Arrays as input,
// Returns an integer in the 0-255 range.
function checksumTwo(array1, array2) {
    var partial1 = array1.reduce(function (sum, v){ return sum + v; }, 0);
    var partial2 = array2.reduce(function (sum, v){ return sum + v; }, 0);
    return -( partial1 + partial2 ) & 0xFF;
}


// Trivial utility. Converts a number to hex and pads with zeroes up to 2 characters.
function hexpad(number) {
    return number.toString(16).toUpperCase().padStart(2, '0');
}


// Polyfill as per https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number/isInteger
Number.isInteger = Number.isInteger || function(value) {
    return typeof value === 'number' &&
    isFinite(value) &&
    Math.floor(value) === value;
};


/**
 * @class MemoryMap
 *
 * Represents the contents of a memory layout, with main focus into (possibly sparse) blocks of data.
 *<br/>
 * A {@linkcode MemoryMap} acts as a subclass of
 * {@linkcode https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Map|Map}.
 * In every entry of it, the key is the starting address of a data block (an integer number),
 * and the value is the <tt>Uint8Array</tt> with the data for that block.
 *<br/>
 * The main rationale for this is that a .hex file can contain a single block of contiguous
 * data starting at memory address 0 (and it's the common case for simple .hex files),
 * but complex files with several non-contiguous data blocks are also possible, thus
 * the need for a data structure on top of the <tt>Uint8Array</tt>s.
 *<br/>
 * In order to parse <tt>.hex</tt> files, use the {@linkcode MemoryMap.fromHex} <em>static</em> factory
 * method. In order to write <tt>.hex</tt> files, create a new {@linkcode MemoryMap} and call
 * its {@linkcode MemoryMap.asHexString} method.
 *
 * @extends Map
 * @example
 * import MemoryMap from 'nrf-intel-hex';
 *
 * let memMap1 = new MemoryMap();
 * let memMap2 = new MemoryMap([[0, new Uint8Array(1,2,3,4)]]);
 * let memMap3 = new MemoryMap({0: new Uint8Array(1,2,3,4)});
 * let memMap4 = new MemoryMap({0xCF0: new Uint8Array(1,2,3,4)});
 */
var MemoryMap = function MemoryMap(blocks) {
    var this$1 = this;

    this._blocks = new Map();

    if (blocks && typeof blocks[Symbol.iterator] === 'function') {
        for (var tuple of blocks) {
            if (!(tuple instanceof Array) || tuple.length !== 2) {
                throw new Error('First parameter to MemoryMap constructor must be an iterable of [addr, bytes] or undefined');
            }
            this$1.set(tuple[0], tuple[1]);
        }
    } else if (typeof blocks === 'object') {
        // Try iterating through the object's keys
        var addrs = Object.keys(blocks);
        for (var addr of addrs) {
            this$1.set(parseInt(addr), blocks[addr]);
        }

    } else if (blocks !== undefined && blocks !== null) {
        throw new Error('First parameter to MemoryMap constructor must be an iterable of [addr, bytes] or undefined');
    }
};

var prototypeAccessors = { size: { configurable: true } };

MemoryMap.prototype.set = function set (addr, value) {
    if (!Number.isInteger(addr)) {
        throw new Error('Address passed to MemoryMap is not an integer');
    }
    if (addr < 0) {
        throw new Error('Address passed to MemoryMap is negative');
    }
    if (!(value instanceof Uint8Array)) {
        throw new Error('Bytes passed to MemoryMap are not an Uint8Array');
    }
    return this._blocks.set(addr, value);
};
// Delegate the following to the 'this._blocks' Map:
MemoryMap.prototype.get = function get (addr){ return this._blocks.get(addr);};
MemoryMap.prototype.clear = function clear ()  { return this._blocks.clear();  };
MemoryMap.prototype.delete = function delete$1 (addr) { return this._blocks.delete(addr); };
MemoryMap.prototype.entries = function entries (){ return this._blocks.entries();};
MemoryMap.prototype.forEach = function forEach (callback, that) { return this._blocks.forEach(callback, that); };
MemoryMap.prototype.has = function has (addr){ return this._blocks.has(addr);};
MemoryMap.prototype.keys = function keys ()   { return this._blocks.keys();   };
MemoryMap.prototype.values = function values () { return this._blocks.values(); };
prototypeAccessors.size.get = function ()   { return this._blocks.size;     };
MemoryMap.prototype[Symbol.iterator] = function () { return this._blocks[Symbol.iterator](); };


/**
 * Parses a string containing data formatted in "Intel HEX" format, and
 * returns an instance of {@linkcode MemoryMap}.
 *<br/>
 * The insertion order of keys in the {@linkcode MemoryMap} is guaranteed to be strictly
 * ascending. In other words, when iterating through the {@linkcode MemoryMap}, the addresses
 * will be ordered in ascending order.
 *<br/>
 * The parser has an opinionated behaviour, and will throw a descriptive error if it
 * encounters some malformed input. Check the project's
 * {@link https://github.com/NordicSemiconductor/nrf-intel-hex#Features|README file} for details.
 *<br/>
 * If <tt>maxBlockSize</tt> is given, any contiguous data block larger than that will
 * be split in several blocks.
 *
 * @param {String} hexText The contents of a .hex file.
 * @param {Number} [maxBlockSize=Infinity] Maximum size of the returned <tt>Uint8Array</tt>s.
 *
 * @return {MemoryMap}
 *
 * @example
 * import MemoryMap from 'nrf-intel-hex';
 *
 * let intelHexString =
 * ":100000000102030405060708090A0B0C0D0E0F1068\n" +
 * ":00000001FF";
 *
 * let memMap = MemoryMap.fromHex(intelHexString);
 *
 * for (let [address, dataBlock] of memMap) {
 * console.log('Data block at ', address, ', bytes: ', dataBlock);
 * }
 */
MemoryMap.fromHex = function fromHex (hexText, maxBlockSize) {
        if ( maxBlockSize === void 0 ) maxBlockSize = Infinity;

    var blocks = new MemoryMap();

    var lastCharacterParsed = 0;
    var matchResult;
    var recordCount = 0;

    // Upper Linear Base Address, the 16 most significant bits (2 bytes) of
    // the current 32-bit (4-byte) address
    // In practice this is a offset that is summed to the "load offset" of the
    // data records
    var ulba = 0;

    hexLineRegexp.lastIndex = 0; // Reset the regexp, if not it would skip content when called twice

    while ((matchResult = hexLineRegexp.exec(hexText)) !== null) {
        recordCount++;

        // By default, a regexp loop ignores gaps between matches, but
        // we want to be aware of them.
        if (lastCharacterParsed !== matchResult.index) {
            throw new Error(
                'Malformed hex file: Could not parse between characters ' +
                lastCharacterParsed +
                ' and ' +
                matchResult.index +
                ' ("' +
                hexText.substring(lastCharacterParsed, Math.min(matchResult.index, lastCharacterParsed + 16)).trim() +
                '")');
        }
        lastCharacterParsed = hexLineRegexp.lastIndex;

        // Give pretty names to the match's capture groups
        var recordStr = matchResult[1];
            var recordChecksum = matchResult[2];

        // String to Uint8Array - https://stackoverflow.com/questions/43131242/how-to-convert-a-hexademical-string-of-data-to-an-arraybuffer-in-javascript
        var recordBytes = new Uint8Array(recordStr.match(/[\da-f]{2}/gi).map(function (h){ return parseInt(h, 16); }));

        var recordLength = recordBytes[0];
        if (recordLength + 4 !== recordBytes.length) {
            throw new Error('Mismatched record length at record ' + recordCount + ' (' + matchResult[0].trim() + '), expected ' + (recordLength) + ' data bytes but actual length is ' + (recordBytes.length - 4));
        }

        var cs = checksum(recordBytes);
        if (parseInt(recordChecksum, 16) !== cs) {
            throw new Error('Checksum failed at record ' + recordCount + ' (' + matchResult[0].trim() + '), should be ' + cs.toString(16) );
        }

        var offset = (recordBytes[1] << 8) + recordBytes[2];
        var recordType = recordBytes[3];
        var data = recordBytes.subarray(4);

        if (recordType === 0) {
            // Data record, contains data
            // Create a new block, at (upper linear base address + offset)
            if (blocks.has(ulba + offset)) {
                throw new Error('Duplicated data at record ' + recordCount + ' (' + matchResult[0].trim() + ')');
            }
            if (offset + data.length > 0x10000) {
                throw new Error(
                    'Data at record ' +
                    recordCount +
                    ' (' +
                    matchResult[0].trim() +
                    ') wraps over 0xFFFF. This would trigger ambiguous behaviour. Please restructure your data so that for every record the data offset plus the data length do not exceed 0xFFFF.');
            }

            blocks.set( ulba + offset, data );

        } else {

            // All non-data records must have a data offset of zero
            if (offset !== 0) {
                throw new Error('Record ' + recordCount + ' (' + matchResult[0].trim() + ') must have 0000 as data offset.');
            }

            switch (recordType) {
            case 1: // EOF
                if (lastCharacterParsed !== hexText.length) {
                    // This record should be at the very end of the string
                    throw new Error('There is data after an EOF record at record ' + recordCount);
                }

                return blocks.join(maxBlockSize);

            case 2: // Extended Segment Address Record
                // Sets the 16 most significant bits of the 20-bit Segment Base
                // Address for the subsequent data.
                ulba = ((data[0] << 8) + data[1]) << 4;
                break;

            case 3: // Start Segment Address Record
                // Do nothing. Record type 3 only applies to 16-bit Intel CPUs,
                // where it should reset the program counter (CS+IP CPU registers)
                break;

            case 4: // Extended Linear Address Record
                // Sets the 16 most significant (upper) bits of the 32-bit Linear Address
                // for the subsequent data
                ulba = ((data[0] << 8) + data[1]) << 16;
                break;

            case 5: // Start Linear Address Record
                // Do nothing. Record type 5 only applies to 32-bit Intel CPUs,
                // where it should reset the program counter (EIP CPU register)
                // It might have meaning for other CPU architectures
                // (see http://infocenter.arm.com/help/index.jsp?topic=/com.arm.doc.faqs/ka9903.html )
                // but will be ignored nonetheless.
                break;
            default:
                throw new Error('Invalid record type 0x' + hexpad(recordType) + ' at record ' + recordCount + ' (should be between 0x00 and 0x05)');
            }
        }
    }

    if (recordCount) {
        throw new Error('No EOF record at end of file');
    } else {
        throw new Error('Malformed .hex file, could not parse any registers');
    }
};


/**
 * Returns a <strong>new</strong> instance of {@linkcode MemoryMap}, containing
 * the same data, but concatenating together those memory blocks that are adjacent.
 *<br/>
 * The insertion order of keys in the {@linkcode MemoryMap} is guaranteed to be strictly
 * ascending. In other words, when iterating through the {@linkcode MemoryMap}, the addresses
 * will be ordered in ascending order.
 *<br/>
 * If <tt>maxBlockSize</tt> is given, blocks will be concatenated together only
 * until the joined block reaches this size in bytes. This means that the output
 * {@linkcode MemoryMap} might have more entries than the input one.
 *<br/>
 * If there is any overlap between blocks, an error will be thrown.
 *<br/>
 * The returned {@linkcode MemoryMap} will use newly allocated memory.
 *
 * @param {Number} [maxBlockSize=Infinity] Maximum size of the <tt>Uint8Array</tt>s in the
 * returned {@linkcode MemoryMap}.
 *
 * @return {MemoryMap}
 */
MemoryMap.prototype.join = function join (maxBlockSize) {
        var this$1 = this;
        if ( maxBlockSize === void 0 ) maxBlockSize = Infinity;


    // First pass, create a Map of address→length of contiguous blocks
    var sortedKeys = Array.from(this.keys()).sort(function (a,b){ return a-b; });
    var blockSizes = new Map();
    var lastBlockAddr = -1;
    var lastBlockEndAddr = -1;

    for (var i=0,l=sortedKeys.length; i<l; i++) {
        var blockAddr = sortedKeys[i];
        var blockLength = this$1.get(sortedKeys[i]).length;

        if (lastBlockEndAddr === blockAddr && (lastBlockEndAddr - lastBlockAddr) < maxBlockSize) {
            // Grow when the previous end address equals the current,
            // and we don't go over the maximum block size.
            blockSizes.set(lastBlockAddr, blockSizes.get(lastBlockAddr) + blockLength);
            lastBlockEndAddr += blockLength;
        } else if (lastBlockEndAddr <= blockAddr) {
            // Else mark a new block.
            blockSizes.set(blockAddr, blockLength);
            lastBlockAddr = blockAddr;
            lastBlockEndAddr = blockAddr + blockLength;
        } else {
            throw new Error('Overlapping data around address 0x' + blockAddr.toString(16));
        }
    }

    // Second pass: allocate memory for the contiguous blocks and copy data around.
    var mergedBlocks = new MemoryMap();
    var mergingBlock;
    var mergingBlockAddr = -1;
    for (var i$1=0,l$1=sortedKeys.length; i$1<l$1; i$1++) {
        var blockAddr$1 = sortedKeys[i$1];
        if (blockSizes.has(blockAddr$1)) {
            mergingBlock = new Uint8Array(blockSizes.get(blockAddr$1));
            mergedBlocks.set(blockAddr$1, mergingBlock);
            mergingBlockAddr = blockAddr$1;
        }
        mergingBlock.set(this$1.get(blockAddr$1), blockAddr$1 - mergingBlockAddr);
    }

    return mergedBlocks;
};

/**
 * Given a {@link https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Map|<tt>Map</tt>}
 * of {@linkcode MemoryMap}s, indexed by a alphanumeric ID,
 * returns a <tt>Map</tt> of address to tuples (<tt>Arrays</tt>s of length 2) of the form
 * <tt>(id, Uint8Array)</tt>s.
 *<br/>
 * The scenario for using this is having several {@linkcode MemoryMap}s, from several calls to
 * {@link module:nrf-intel-hex~hexToArrays|hexToArrays}, each having a different identifier.
 * This function locates where those memory block sets overlap, and returns a <tt>Map</tt>
 * containing addresses as keys, and arrays as values. Each array will contain 1 or more
 * <tt>(id, Uint8Array)</tt> tuples: the identifier of the memory block set that has
 * data in that region, and the data itself. When memory block sets overlap, there will
 * be more than one tuple.
 *<br/>
 * The <tt>Uint8Array</tt>s in the output are
 * {@link https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/TypedArray/subarray|subarrays}
 * of the input data; new memory is <strong>not</strong> allocated for them.
 *<br/>
 * The insertion order of keys in the output <tt>Map</tt> is guaranteed to be strictly
 * ascending. In other words, when iterating through the <tt>Map</tt>, the addresses
 * will be ordered in ascending order.
 *<br/>
 * When two blocks overlap, the corresponding array of tuples will have the tuples ordered
 * in the insertion order of the input <tt>Map</tt> of block sets.
 *<br/>
 *
 * @param {Map.MemoryMap} memoryMaps The input memory block sets
 *
 * @example
 * import MemoryMap from 'nrf-intel-hex';
 *
 * let memMap1 = MemoryMap.fromHex( hexdata1 );
 * let memMap2 = MemoryMap.fromHex( hexdata2 );
 * let memMap3 = MemoryMap.fromHex( hexdata3 );
 *
 * let maps = new Map([
 *  ['file A', blocks1],
 *  ['file B', blocks2],
 *  ['file C', blocks3]
 * ]);
 *
 * let overlappings = MemoryMap.overlapMemoryMaps(maps);
 *
 * for (let [address, tuples] of overlappings) {
 * // if 'tuples' has length > 1, there is an overlap starting at 'address'
 *
 * for (let [address, tuples] of overlappings) {
 *     let [id, bytes] = tuple;
 *     // 'id' in this example is either 'file A', 'file B' or 'file C'
 * }
 * }
 * @return {Map.Array<mixed,Uint8Array>} The map of possibly overlapping memory blocks
 */
MemoryMap.overlapMemoryMaps = function overlapMemoryMaps (memoryMaps) {
    // First pass: create a list of addresses where any block starts or ends.
    var cuts = new Set();
    for (var [, blocks] of memoryMaps) {
        for (var [address, block] of blocks) {
            cuts.add(address);
            cuts.add(address + block.length);
        }
    }

    var orderedCuts = Array.from(cuts.values()).sort(function (a,b){ return a-b; });
    var overlaps = new Map();

    // Second pass: iterate through the cuts, get slices of every intersecting blockset
    var loop = function ( i, l ) {
        var cut = orderedCuts[i];
        var nextCut = orderedCuts[i+1];
        var tuples = [];

        for (var [setId, blocks$1] of memoryMaps) {
            // Find the block with the highest address that is equal or lower to
            // the current cut (if any)
            var blockAddr = Array.from(blocks$1.keys()).reduce(function (acc, val){
                if (val > cut) {
                    return acc;
                }
                return Math.max( acc, val );
            }, -1);

            if (blockAddr !== -1) {
                var block$1 = blocks$1.get(blockAddr);
                var subBlockStart = cut - blockAddr;
                var subBlockEnd = nextCut - blockAddr;

                if (subBlockStart < block$1.length) {
                    tuples.push([ setId, block$1.subarray(subBlockStart, subBlockEnd) ]);
                }
            }
        }

        if (tuples.length) {
            overlaps.set(cut, tuples);
        }
    };

        for (var i=0, l=orderedCuts.length-1; i<l; i++) loop( i, l );

    return overlaps;
};


/**
 * Given the output of the {@linkcode MemoryMap.overlapMemoryMaps|overlapMemoryMaps}
 * (a <tt>Map</tt> of address to an <tt>Array</tt> of <tt>(id, Uint8Array)</tt> tuples),
 * returns a {@linkcode MemoryMap}. This discards the IDs in the process.
 *<br/>
 * The output <tt>Map</tt> contains as many entries as the input one (using the same addresses
 * as keys), but the value for each entry will be the <tt>Uint8Array</tt> of the <b>last</b>
 * tuple for each address in the input data.
 *<br/>
 * The scenario is wanting to join together several parsed .hex files, not worrying about
 * their overlaps.
 *<br/>
 *
 * @param {Map.Array<mixed,Uint8Array>} overlaps The (possibly overlapping) input memory blocks
 * @return {MemoryMap} The flattened memory blocks
 */
MemoryMap.flattenOverlaps = function flattenOverlaps (overlaps) {
    return new MemoryMap(
        Array.from(overlaps.entries()).map(function (ref) {
                var address = ref[0];
                var tuples = ref[1];

            return [address, tuples[tuples.length - 1][1] ];
        })
    );
};


/**
 * Returns a new instance of {@linkcode MemoryMap}, where:
 *
 * <ul>
 *  <li>Each key (the start address of each <tt>Uint8Array</tt>) is a multiple of
 *<tt>pageSize</tt></li>
 *  <li>The size of each <tt>Uint8Array</tt> is exactly <tt>pageSize</tt></li>
 *  <li>Bytes from the input map to bytes in the output</li>
 *  <li>Bytes not in the input are replaced by a padding value</li>
 * </ul>
 *<br/>
 * The scenario is wanting to prepare pages of bytes for a write operation, where the write
 * operation affects a whole page/sector at once.
 *<br/>
 * The insertion order of keys in the output {@linkcode MemoryMap} is guaranteed
 * to be strictly ascending. In other words, when iterating through the
 * {@linkcode MemoryMap}, the addresses will be ordered in ascending order.
 *<br/>
 * The <tt>Uint8Array</tt>s in the output will be newly allocated.
 *<br/>
 *
 * @param {Number} [pageSize=1024] The size of the output pages, in bytes
 * @param {Number} [pad=0xFF] The byte value to use for padding
 * @return {MemoryMap}
 */
MemoryMap.prototype.paginate = function paginate ( pageSize, pad) {
        var this$1 = this;
        if ( pageSize === void 0 ) pageSize=1024;
        if ( pad === void 0 ) pad=0xFF;

    if (pageSize <= 0) {
        throw new Error('Page size must be greater than zero');
    }
    var outPages = new MemoryMap();
    var page;

    var sortedKeys = Array.from(this.keys()).sort(function (a,b){ return a-b; });

    for (var i=0,l=sortedKeys.length; i<l; i++) {
        var blockAddr = sortedKeys[i];
        var block = this$1.get(blockAddr);
        var blockLength = block.length;
        var blockEnd = blockAddr + blockLength;

        for (var pageAddr = blockAddr - (blockAddr % pageSize); pageAddr < blockEnd; pageAddr += pageSize) {
            page = outPages.get(pageAddr);
            if (!page) {
                page = new Uint8Array(pageSize);
                page.fill(pad);
                outPages.set(pageAddr, page);
            }

            var offset = pageAddr - blockAddr;
            var subBlock = (void 0);
            if (offset <= 0) {
                // First page which intersects the block
                subBlock = block.subarray(0, Math.min(pageSize + offset, blockLength));
                page.set(subBlock, -offset);
            } else {
                // Any other page which intersects the block
                subBlock = block.subarray(offset, offset + Math.min(pageSize, blockLength - offset));
                page.set(subBlock, 0);
            }
        }
    }

    return outPages;
};


/**
 * Locates the <tt>Uint8Array</tt> which contains the given offset,
 * and returns the four bytes held at that offset, as a 32-bit unsigned integer.
 *
 *<br/>
 * Behaviour is similar to {@linkcode https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/DataView/getUint32|DataView.prototype.getUint32},
 * except that this operates over a {@linkcode MemoryMap} instead of
 * over an <tt>ArrayBuffer</tt>, and that this may return <tt>undefined</tt> if
 * the address is not <em>entirely</em> contained within one of the <tt>Uint8Array</tt>s.
 *<br/>
 *
 * @param {Number} offset The memory offset to read the data
 * @param {Boolean} [littleEndian=false] Whether to fetch the 4 bytes as a little- or big-endian integer
 * @return {Number|undefined} An unsigned 32-bit integer number
 */
MemoryMap.prototype.getUint32 = function getUint32 (offset, littleEndian) {
        var this$1 = this;

    var keys = Array.from(this.keys());

    for (var i=0,l=keys.length; i<l; i++) {
        var blockAddr = keys[i];
        var block = this$1.get(blockAddr);
        var blockLength = block.length;
        var blockEnd = blockAddr + blockLength;

        if (blockAddr <= offset && (offset+4) <= blockEnd) {
            return (new DataView(block.buffer, offset - blockAddr, 4)).getUint32(0, littleEndian);
        }
    }
    return;
};


/**
 * Returns a <tt>String</tt> of text representing a .hex file.
 * <br/>
 * The writer has an opinionated behaviour. Check the project's
 * {@link https://github.com/NordicSemiconductor/nrf-intel-hex#Features|README file} for details.
 *
 * @param {Number} [lineSize=16] Maximum number of bytes to be encoded in each data record.
 * Must have a value between 1 and 255, as per the specification.
 *
 * @return {String} String of text with the .hex representation of the input binary data
 *
 * @example
 * import MemoryMap from 'nrf-intel-hex';
 *
 * let memMap = new MemoryMap();
 * let bytes = new Uint8Array(....);
 * memMap.set(0x0FF80000, bytes); // The block with 'bytes' will start at offset 0x0FF80000
 *
 * let string = memMap.asHexString();
 */
MemoryMap.prototype.asHexString = function asHexString (lineSize) {
        var this$1 = this;
        if ( lineSize === void 0 ) lineSize = 16;

    var lowAddress  = 0;// 16 least significant bits of the current addr
    var highAddress = -1 << 16; // 16 most significant bits of the current addr
    var records = [];
    if (lineSize <=0) {
        throw new Error('Size of record must be greater than zero');
    } else if (lineSize > 255) {
        throw new Error('Size of record must be less than 256');
    }

    // Placeholders
    var offsetRecord = new Uint8Array(6);
    var recordHeader = new Uint8Array(4);

    var sortedKeys = Array.from(this.keys()).sort(function (a,b){ return a-b; });
    for (var i=0,l=sortedKeys.length; i<l; i++) {
        var blockAddr = sortedKeys[i];
        var block = this$1.get(blockAddr);

        // Sanity checks
        if (!(block instanceof Uint8Array)) {
            throw new Error('Block at offset ' + blockAddr + ' is not an Uint8Array');
        }
        if (blockAddr < 0) {
            throw new Error('Block at offset ' + blockAddr + ' has a negative thus invalid address');
        }
        var blockSize = block.length;
        if (!blockSize) { continue; }   // Skip zero-length blocks


        if (blockAddr > (highAddress + 0xFFFF)) {
            // Insert a new 0x04 record to jump to a new 64KiB block

            // Round up the least significant 16 bits - no bitmasks because they trigger
            // base-2 negative numbers, whereas subtracting the modulo maintains precision
            highAddress = blockAddr - blockAddr % 0x10000;
            lowAddress = 0;

            offsetRecord[0] = 2;// Length
            offsetRecord[1] = 0;// Load offset, high byte
            offsetRecord[2] = 0;// Load offset, low byte
            offsetRecord[3] = 4;// Record type
            offsetRecord[4] = highAddress >> 24;// new address offset, high byte
            offsetRecord[5] = highAddress >> 16;// new address offset, low byte

            records.push(
                ':' +
                Array.prototype.map.call(offsetRecord, hexpad).join('') +
                hexpad(checksum(offsetRecord))
            );
        }

        if (blockAddr < (highAddress + lowAddress)) {
            throw new Error(
                'Block starting at 0x' +
                blockAddr.toString(16) +
                ' overlaps with a previous block.');
        }

        lowAddress = blockAddr % 0x10000;
        var blockOffset = 0;
        var blockEnd = blockAddr + blockSize;
        if (blockEnd > 0xFFFFFFFF) {
            throw new Error('Data cannot be over 0xFFFFFFFF');
        }

        // Loop for every 64KiB memory segment that spans this block
        while (highAddress + lowAddress < blockEnd) {

            if (lowAddress > 0xFFFF) {
                // Insert a new 0x04 record to jump to a new 64KiB block
                highAddress += 1 << 16; // Increase by one
                lowAddress = 0;

                offsetRecord[0] = 2;// Length
                offsetRecord[1] = 0;// Load offset, high byte
                offsetRecord[2] = 0;// Load offset, low byte
                offsetRecord[3] = 4;// Record type
                offsetRecord[4] = highAddress >> 24;// new address offset, high byte
                offsetRecord[5] = highAddress >> 16;// new address offset, low byte

                records.push(
                    ':' +
                    Array.prototype.map.call(offsetRecord, hexpad).join('') +
                    hexpad(checksum(offsetRecord))
                );
            }

            var recordSize = -1;
            // Loop for every record for that spans the current 64KiB memory segment
            while (lowAddress < 0x10000 && recordSize) {
                recordSize = Math.min(
                    lineSize,                        // Normal case
                    blockEnd - highAddress - lowAddress, // End of block
                    0x10000 - lowAddress             // End of low addresses
                );

                if (recordSize) {

                    recordHeader[0] = recordSize;   // Length
                    recordHeader[1] = lowAddress >> 8;// Load offset, high byte
                    recordHeader[2] = lowAddress;// Load offset, low byte
                    recordHeader[3] = 0;// Record type

                    var subBlock = block.subarray(blockOffset, blockOffset + recordSize);   // Data bytes for this record

                    records.push(
                        ':' +
                        Array.prototype.map.call(recordHeader, hexpad).join('') +
                        Array.prototype.map.call(subBlock, hexpad).join('') +
                        hexpad(checksumTwo(recordHeader, subBlock))
                    );

                    blockOffset += recordSize;
                    lowAddress += recordSize;
                }
            }
        }
    }

    records.push(':00000001FF');// EOF record

    return records.join('\n');
};


/**
 * Performs a deep copy of the current {@linkcode MemoryMap}, returning a new one
 * with exactly the same contents, but allocating new memory for each of its
 * <tt>Uint8Array</tt>s.
 *
 * @return {MemoryMap}
 */
MemoryMap.prototype.clone = function clone () {
        var this$1 = this;

    var cloned = new MemoryMap();

    for (var [addr, value] of this$1) {
        cloned.set(addr, new Uint8Array(value));
    }

    return cloned;
};


/**
 * Given one <tt>Uint8Array</tt>, looks through its contents and returns a new
 * {@linkcode MemoryMap}, stripping away those regions where there are only
 * padding bytes.
 * <br/>
 * The start of the input <tt>Uint8Array</tt> is assumed to be offset zero for the output.
 * <br/>
 * The use case here is dumping memory from a working device and try to see the
 * "interesting" memory regions it has. This assumes that there is a constant,
 * predefined padding byte value being used in the "non-interesting" regions.
 * In other words: this will work as long as the dump comes from a flash memory
 * which has been previously erased (thus <tt>0xFF</tt>s for padding), or from a
 * previously blanked HDD (thus <tt>0x00</tt>s for padding).
 * <br/>
 * This method uses <tt>subarray</tt> on the input data, and thus does not allocate memory
 * for the <tt>Uint8Array</tt>s.
 *
 * @param {Uint8Array} bytes The input data
 * @param {Number} [padByte=0xFF] The value of the byte assumed to be used as padding
 * @param {Number} [minPadLength=64] The minimum number of consecutive pad bytes to
 * be considered actual padding
 *
 * @return {MemoryMap}
 */
MemoryMap.fromPaddedUint8Array = function fromPaddedUint8Array (bytes, padByte, minPadLength) {
        if ( padByte === void 0 ) padByte=0xFF;
        if ( minPadLength === void 0 ) minPadLength=64;


    if (!(bytes instanceof Uint8Array)) {
        throw new Error('Bytes passed to fromPaddedUint8Array are not an Uint8Array');
    }

    // The algorithm used is naïve and checks every byte.
    // An obvious optimization would be to implement Boyer-Moore
    // (see https://en.wikipedia.org/wiki/Boyer%E2%80%93Moore_string_search_algorithm )
    // or otherwise start skipping up to minPadLength bytes when going through a non-pad
    // byte.
    // Anyway, we could expect a lot of cases where there is a majority of pad bytes,
    // and the algorithm should check most of them anyway, so the perf gain is questionable.

    var memMap = new MemoryMap();
    var consecutivePads = 0;
    var lastNonPad = -1;
    var firstNonPad = 0;
    var skippingBytes = false;
    var l = bytes.length;

    for (var addr = 0; addr < l; addr++) {
        var byte = bytes[addr];

        if (byte === padByte) {
            consecutivePads++;
            if (consecutivePads >= minPadLength) {
                // Edge case: ignore writing a zero-length block when skipping
                // bytes at the beginning of the input
                if (lastNonPad !== -1) {
                    /// Add the previous block to the result memMap
                    memMap.set(firstNonPad, bytes.subarray(firstNonPad, lastNonPad+1));
                }

                skippingBytes = true;
            }
        } else {
            if (skippingBytes) {
                skippingBytes = false;
                firstNonPad = addr;
            }
            lastNonPad = addr;
            consecutivePads = 0;
        }
    }

    // At EOF, add the last block if not skipping bytes already (and input not empty)
    if (!skippingBytes && lastNonPad !== -1) {
        memMap.set(firstNonPad, bytes.subarray(firstNonPad, l));
    }

    return memMap;
};


/**
 * Returns a new instance of {@linkcode MemoryMap}, containing only data between
 * the addresses <tt>address</tt> and <tt>address + length</tt>.
 * Behaviour is similar to {@linkcode https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Array/slice|Array.prototype.slice},
 * in that the return value is a portion of the current {@linkcode MemoryMap}.
 *
 * <br/>
 * The returned {@linkcode MemoryMap} might be empty.
 *
 * <br/>
 * Internally, this uses <tt>subarray</tt>, so new memory is not allocated.
 *
 * @param {Number} address The start address of the slice
 * @param {Number} length The length of memory map to slice out
 * @return {MemoryMap}
 */
MemoryMap.prototype.slice = function slice (address, length){
        var this$1 = this;
        if ( length === void 0 ) length = Infinity;

    if (length < 0) {
        throw new Error('Length of the slice cannot be negative');
    }

    var sliced = new MemoryMap();

    for (var [blockAddr, block] of this$1) {
        var blockLength = block.length;

        if ((blockAddr + blockLength) >= address && blockAddr < (address + length)) {
            var sliceStart = Math.max(address, blockAddr);
            var sliceEnd = Math.min(address + length, blockAddr + blockLength);
            var sliceLength = sliceEnd - sliceStart;
            var relativeSliceStart = sliceStart - blockAddr;

            if (sliceLength > 0) {
                sliced.set(sliceStart, block.subarray(relativeSliceStart, relativeSliceStart + sliceLength));
            }
        }
    }
    return sliced;
};

/**
 * Returns a new instance of {@linkcode https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/DataView/getUint32|Uint8Array}, containing only data between
 * the addresses <tt>address</tt> and <tt>address + length</tt>. Any byte without a value
 * in the input {@linkcode MemoryMap} will have a value of <tt>padByte</tt>.
 *
 * <br/>
 * This method allocates new memory.
 *
 * @param {Number} address The start address of the slice
 * @param {Number} length The length of memory map to slice out
 * @param {Number} [padByte=0xFF] The value of the byte assumed to be used as padding
 * @return {MemoryMap}
 */
MemoryMap.prototype.slicePad = function slicePad (address, length, padByte){
        var this$1 = this;
        if ( padByte === void 0 ) padByte=0xFF;

    if (length < 0) {
        throw new Error('Length of the slice cannot be negative');
    }
        
    var out = (new Uint8Array(length)).fill(padByte);

    for (var [blockAddr, block] of this$1) {
        var blockLength = block.length;

        if ((blockAddr + blockLength) >= address && blockAddr < (address + length)) {
            var sliceStart = Math.max(address, blockAddr);
            var sliceEnd = Math.min(address + length, blockAddr + blockLength);
            var sliceLength = sliceEnd - sliceStart;
            var relativeSliceStart = sliceStart - blockAddr;

            if (sliceLength > 0) {
                out.set(block.subarray(relativeSliceStart, relativeSliceStart + sliceLength), sliceStart - address);
            }
        }
    }
    return out;
};

/**
 * Checks whether the current memory map contains the one given as a parameter.
 *
 * <br/>
 * "Contains" means that all the offsets that have a byte value in the given
 * memory map have a value in the current memory map, and that the byte values
 * are the same.
 *
 * <br/>
 * An empty memory map is always contained in any other memory map.
 *
 * <br/>
 * Returns boolean <tt>true</tt> if the memory map is contained, <tt>false</tt>
 * otherwise.
 *
 * @param {MemoryMap} memMap The memory map to check
 * @return {Boolean}
 */
MemoryMap.prototype.contains = function contains (memMap) {
        var this$1 = this;

    for (var [blockAddr, block] of memMap) {

        var blockLength = block.length;

        var slice = this$1.slice(blockAddr, blockLength).join().get(blockAddr);

        if ((!slice) || slice.length !== blockLength ) {
            return false;
        }

        for (var i in block) {
            if (block[i] !== slice[i]) {
                return false;
            }
        }
    }
    return true;
};

Object.defineProperties( MemoryMap.prototype, prototypeAccessors );

return MemoryMap;

})));


},{}]},{},[18])(18)
});

//# sourceMappingURL=dap.bundle.js.map
