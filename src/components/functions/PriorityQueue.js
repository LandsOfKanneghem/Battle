export class PriorityQueue {
    constructor() {
        this.heap = []
        this.size = 0
    }

    siftUp(i) {
        while (this.heap[i].f < this.heap[Math.round((i - 1) / 2)].f) {
            [this.heap[i], this.heap[Math.round((i - 1) / 2)]] = [this.heap[Math.round((i - 1) / 2)], this.heap[i]]
            i = Math.round((i - 1) / 2)
        }
    }

    siftDown(i) {
        let left, right, j
        while (2 * i + 1 < this.size) {
            left = 2 * i + 1
            right = 2 * i + 2
            j = left
            if (right < this.size && this.heap[right].f < this.heap[left].f) j = right
            if (this.heap[i].f <= this.heap[j].f) break
            [this.heap[i], this.heap[j]] = [this.heap[j], this.heap[i]]
            i = j
        }           
    }    

    push(value) {
        this.size++
        this.heap[this.size - 1] = value
        if (this.size > 1) this.siftUp(this.size - 1)
    }

    extractMin() {
        let min = this.heap[0]
        this.heap[0] = this.heap[this.size - 1]
        this.size--
        this.siftDown(0)
        this.heap.pop()
        return min
    }
}