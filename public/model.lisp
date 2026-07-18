;;; lispllm — a complete GPT. this file is the whole model.
;;; everything on this page is a live view into these definitions.

;; -------- attention: three questions per token --------
(define (head h x)
  (let* ((q (matmul x (wq h)))            ; what am i looking for?
         (k (matmul x (wk h)))            ; what do i contain?
         (v (matmul x (wv h)))            ; what will i pass along if noticed?
         (scores  (scale (matmul q (transpose k))
                         (/ 1.0 (sqrt (n-cols k)))))
         (weights (softmax (causal-mask scores))))
    (matmul weights v)))

(define ablated '())                      ; try: (set! ablated '((2 . 1)))

(define (attention x layer)
  (let ((xn (layernorm x (ln1 layer))))
    (matmul (concat (map (lambda (h)
                           (if (member (id h) ablated)
                               (zeros (n-rows xn) (n-cols (wv h)))
                               (head h xn)))
                         (heads layer)))
            (wo layer))))

(define (mlp x layer)
  (matmul (gelu (matmul (layernorm x (ln2 layer)) (w-up layer)))
          (w-down layer)))

(define (block x layer)                   ; read from the stream, think, add back
  (let* ((x (add x (attention x layer)))
         (x (add x (mlp x layer))))
    x))

;; -------- the model is a fold --------
(define (embed tokens)
  (add (rows tok-emb tokens)
       (rows pos-emb (iota (length tokens)))))

(define (gpt tokens)
  (matmul (layernorm (fold block (embed tokens) layers) ln-f)
          (transpose tok-emb)))           ; the output layer is the embedding, reused

;; -------- the loop that talks --------
(define temperature 0.8)

(define (next-token tokens)
  (sample (scale (last-row (gpt (last-n ctx tokens)))
                 (/ 1.0 temperature))))

(define (generate tokens n)
  (if (= n 0)
      tokens
      (generate (snoc tokens (next-token tokens)) (- n 1))))

;; that's all of it. scroll on — or open the repl and start poking.
