'use strict'

const log = require('../logger'),
      { SkillID, Vec3 } = require('./types')

const MULT_INT16_TO_RAD = 1 / 0x8000 * Math.PI,
	  MULT_RAD_TO_INT16 = 1 / Math.PI * 0x8000

class Readable {
	constructor(buffer, position = 0) {
		this.buffer = buffer
		this.position = position
	}

	seek(n) { return this.position = n }
	skip(n) { return this.position += n }

	bool() {
		const ret = this.byte()
		if(ret > 1) log.warn(new Error('read byte not 0 or 1 for bool'))
		return !!ret
	}

	byte() { return this.buffer.readUInt8(this.position++) }

	bytes(n) { return Buffer.from(this.buffer.slice(this.position, this.position += n)) }

	uint16() {
		const ret = this.buffer.readUInt16LE(this.position)
		this.position += 2
		return ret
	}

	uint32() {
		const ret = this.buffer.readUInt32LE(this.position)
		this.position += 4
		return ret
	}

	uint64() {
		return BigInt(this.uint32()) | (BigInt(this.uint32()) << 32n)
	}

	int16() {
		const ret = this.buffer.readInt16LE(this.position)
		this.position += 2
		return ret
	}

	int32() {
		const ret = this.buffer.readInt32LE(this.position)
		this.position += 4
		return ret
	}

	int64() {
		return BigInt(this.uint32()) | (BigInt(this.int32()) << 32n)
	}

	vec3() {
		return new Vec3(this.float(), this.float(), this.float())
	}

	vec3fa() {
		return new Vec3(this.float() * MULT_INT16_TO_RAD, this.float() * MULT_INT16_TO_RAD, this.float() * MULT_INT16_TO_RAD)
	}

	angle() {
		return this.int16() * MULT_INT16_TO_RAD
	}

	skillid() {
		const raw = this.uint64(),
			type = Number((raw >> 28n) & 0xFn),
            npc = Boolean(raw & 0x0100000000n)

		return new SkillID({
            id: Number(raw & (npc ? 0xffffn : 0xfffffffn)),
			huntingZoneId: npc ? Number(raw >> 16n & 0xfffn) : 0,
			type,
			npc,
			reserved: Number(raw >> 33n)
		})
	}

	float() {
		const ret = this.buffer.readFloatLE(this.position)
		this.position += 4
		return ret
	}

	double() {
		const ret = this.buffer.readDoubleLE(this.position)
		this.position += 8
		return ret
	}

	string() {
		const ret = []
		let c, i = -1
		while(c = this.uint16()) ret[++i] = c
		return String.fromCharCode.apply(null, ret)
	}
}

class Writeable {
	constructor(length) {
		this.length = length
		this.buffer = Buffer.alloc(this.length)
		this.position = 0
	}

	seek(n) { this.position = n }
	skip(n) { this.position += n }

	bool(b) { this.buffer[this.position++] = !!b }
	byte(n) { this.buffer[this.position++] = n }
	bytes(buf) {
		if(buf) {
			buf.copy(this.buffer, this.position)
			this.position += buf.length
		}
	}
	uint16(n = 0) { this.position = this.buffer.writeUInt16LE(n & 0xffff, this.position) }
	uint32(n = 0) { this.position = this.buffer.writeUInt32LE(n >>> 0, this.position) }
	uint64(n = 0n) {
        if(typeof n === 'number')
            n = BigInt(n)
		this.uint32(Number(n & 0xffffffffn))
		this.uint32(Number((n >> 32n) & 0xffffffffn))
	}
	vec3(v = {}) {
		this.float(v.x)
		this.float(v.y)
		this.float(v.z)
	}
	vec3fa(v = {}) {
		this.float(Math.round(v.x * MULT_RAD_TO_INT16 % 0x10000))
		this.float(Math.round(v.y * MULT_RAD_TO_INT16 % 0x10000))
		this.float(Math.round(v.z * MULT_RAD_TO_INT16 % 0x10000))
	}
	angle(r = 0) { this.int16(Math.round(r * MULT_RAD_TO_INT16)) }

	skillid(obj = {}) {
        if(typeof obj === 'number')
            obj = {type: 1, id: obj}

		let raw = BigInt((Number(obj.id) || 0) & (obj.npc ? 0xffff : 0xfffffff))
		if (obj.npc)
            raw |= BigInt(obj.huntingZoneId & 0xfff) << 16n
		raw |= BigInt(obj.type & 0xf) << 28n
		raw |= BigInt(obj.npc & 1) << 32n
		raw |= BigInt(obj.reserved & 1) << 33n

		this.uint64(raw)
	}

	float(n = 0) { this.position = this.buffer.writeFloatLE(n, this.position) }
	double(n = 0) { this.position = this.buffer.writeDoubleLE(n, this.position) }
	string(str = '') { this.buffer.fill(str + '\0', this.position, this.position += (str.length + 1) * 2, 'ucs2') }
}

Object.assign(Writeable.prototype, {
	int16: Writeable.prototype.uint16,
	int32: Writeable.prototype.uint32,
	int64: Writeable.prototype.uint64
})

module.exports = {
	Readable,
	Writeable
}