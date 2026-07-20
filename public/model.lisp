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

;;; ---------------------------------------------------------------------------
;;; how to read this file
;;; ---------------------------------------------------------------------------
;;;
;;; Lisp puts the operation first: (add x y) means “call add with x and y.”
;;; Every parenthesized expression returns a value, so expressions nest:
;;; (softmax (causal-mask scores)) masks scores first, then normalizes them.
;;;
;;; (define name value) creates a value. (define (name args...) body) creates a
;;; function. let names values that can be computed independently; let* lets a
;;; later name use an earlier one. A leading quote means data, not a call, so
;;; '((2 . 1)) is a list containing the pair “layer 2, head 1.” Semicolons begin
;;; comments. The REPL can inspect any name in this file; try (help) at any time.

;;; head: one attention head
;;; x is a [time × model-width] tensor. wq, wk, and wv project each character
;;; into smaller query, key, and value vectors. q·kᵀ scores which earlier
;;; characters are relevant; causal-mask hides future positions; softmax turns
;;; the remaining scores into weights. weights·v returns the information this
;;; head passes onward. Try: (shape (wq (nth 0 (heads (nth 0 layers)))))

;;; attention: all heads in one layer
;;; layernorm prepares the residual stream. map runs head over every head record,
;;; unless its (layer . head) id appears in ablated; concat rejoins the results,
;;; and wo projects them back to model width. Try: (set! ablated '((0 . 0)))

;;; mlp and block: think locally, then add both corrections back
;;; The MLP expands each position with w-up, applies gelu, and contracts with
;;; w-down. block adds attention and MLP results to x instead of replacing x;
;;; that shared, repeatedly updated x is the residual stream.

;;; embed and gpt: tokens in, next-character logits out
;;; rows looks up one learned token vector and one learned position vector for
;;; each token. fold sends the resulting sequence through every layer. The final
;;; matmul reuses tok-embᵀ as the output classifier (“tied embeddings”), yielding
;;; [time × vocabulary] logits. Try: (shape (gpt '(20 15 25)))

;;; temperature and next-token: turn logits into one sampled character
;;; last-row keeps only the newest position. Dividing by a small temperature
;;; sharpens preferences; a large temperature flattens them. sample draws one
;;; token id from that distribution. Try: (set! temperature 2.0)

;;; generate: the complete autoregressive loop
;;; n = 0 is the base case. Otherwise next-token chooses one id, snoc appends it,
;;; and generate calls itself with n - 1. One recursive step equals one generated
;;; character. Try: (generate '(20) 10)
