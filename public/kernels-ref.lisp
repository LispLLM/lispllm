;;; kernels-ref.lisp — pure-Lisp reference implementations of every native
;;; tensor primitive (INV-3). These run on small shapes via tensor->lists /
;;; lists->tensor, and are tested for equivalence against the native kernels.

;; ---- helpers on nested lists ----
(define (elt m i j) (nth j (nth i m)))
(define (dot a b)
  (fold + 0 (map (lambda (i) (* (nth i a) (nth i b)))
                 (iota (length a)))))
(define (columns m)
  (map (lambda (j) (map (lambda (row) (nth j row)) m))
       (iota (length (nth 0 m)))))
(define (map2 f a b)
  (map (lambda (i) (f (nth i a) (nth i b))) (iota (length a))))
(define (sum xs) (fold + 0 xs))
(define (mean xs) (/ (sum xs) (length xs)))
(define (tanh-ref x)
  (let ((e2x (exp (* 2 x))))
    (/ (- e2x 1) (+ e2x 1))))

;; ---- matmul ----
(define (matmul-ref a b)
  (let ((al (tensor->lists a))
        (bcols (columns (tensor->lists b))))
    (lists->tensor
     (map (lambda (row) (map (lambda (col) (dot row col)) bcols))
          al))))

;; ---- transpose ----
(define (transpose-ref m)
  (lists->tensor (columns (tensor->lists m))))

;; ---- add ----
(define (vector? t) (= (length (shape t)) 1))
(define (add-ref a b)
  (if (vector? a)
      (lists->tensor (map2 + (tensor->lists a) (tensor->lists b)))
      (lists->tensor (map2 (lambda (ra rb) (map2 + ra rb))
                           (tensor->lists a) (tensor->lists b)))))

;; ---- scale ----
(define (scale-row row s) (map (lambda (x) (* x s)) row))
(define (scale-ref m s)
  (if (vector? m)
      (lists->tensor (scale-row (tensor->lists m) s))
      (lists->tensor (map (lambda (row) (scale-row row s)) (tensor->lists m)))))

;; ---- softmax (row-wise, max-subtracted) ----
(define (softmax-row row)
  (let* ((mx (fold max (nth 0 row) row))
         (es (map (lambda (x) (exp (- x mx))) row))
         (z (sum es)))
    (map (lambda (e) (/ e z)) es)))
(define (softmax-ref m)
  (if (vector? m)
      (lists->tensor (softmax-row (tensor->lists m)))
      (lists->tensor (map softmax-row (tensor->lists m)))))

;; ---- layernorm (last dim, eps 1e-5, gain+bias) ----
(define (layernorm-row row g b)
  (let* ((mu (mean row))
         (var (mean (map (lambda (x) (* (- x mu) (- x mu))) row)))
         (inv (/ 1.0 (sqrt (+ var 0.00001)))))
    (map (lambda (i)
           (+ (* (* (- (nth i row) mu) inv) (nth i g)) (nth i b)))
         (iota (length row)))))
(define (layernorm-ref m params)
  (let ((g (tensor->lists (ln-g params)))
        (b (tensor->lists (ln-b params))))
    (if (vector? m)
        (lists->tensor (layernorm-row (tensor->lists m) g b))
        (lists->tensor (map (lambda (row) (layernorm-row row g b))
                            (tensor->lists m))))))

;; ---- gelu (tanh approximation) ----
(define (gelu-x x)
  (* 0.5 x (+ 1 (tanh-ref (* (sqrt (/ 2 3.141592653589793))
                             (+ x (* 0.044715 x x x)))))))
(define (gelu-ref m)
  (lists->tensor (map (lambda (row) (map gelu-x row)) (tensor->lists m))))

;; ---- causal-mask (set j > i to -1e9) ----
(define (causal-mask-ref m)
  (let ((rows (tensor->lists m)))
    (lists->tensor
     (map (lambda (i)
            (map (lambda (j)
                   (if (> j i) -1000000000.0 (elt rows i j)))
                 (iota (length (nth i rows)))))
          (iota (length rows))))))

;; ---- concat (column-wise) ----
(define (append2 a b) (fold (lambda (acc x) (snoc acc x)) a b))
(define (concat-ref ts)
  (let ((mats (map tensor->lists ts)))
    (lists->tensor
     (map (lambda (i) (fold (lambda (acc m) (append2 acc (nth i m))) '() mats))
         (iota (length (nth 0 mats)))))))

;; ---- rows (gather) ----
(define (rows-ref m idxs)
  (let ((rl (tensor->lists m)))
    (lists->tensor (map (lambda (i) (nth i rl)) idxs))))

;; ---- last-row ----
(define (last-row-ref m)
  (let ((rl (tensor->lists m)))
    (lists->tensor (nth (- (length rl) 1) rl))))

;; ---- zeros ----
(define (zeros-ref r c)
  (lists->tensor (map (lambda (i) (map (lambda (j) 0.0) (iota c))) (iota r))))

;; ---- argmax ----
(define (argmax-ref v)
  (let ((xs (tensor->lists v)))
    (fold (lambda (best i) (if (> (nth i xs) (nth best xs)) i best))
          0 (iota (length xs)))))

;; ---- top-k ----
(define (top-k-ref k v)
  (let* ((xs (tensor->lists v))
         (kth (nth (- k 1) (sort-desc xs))))
    (lists->tensor (map (lambda (x) (if (< x kth) -1000000000.0 x)) xs))))
(define (sort-desc xs)
  (if (null? xs) '()
      (let ((mx (fold max (car xs) xs)))
        (cons mx (sort-desc (remove-one mx xs))))))
(define (remove-one x xs)
  (cond ((null? xs) '())
        ((= (car xs) x) (cdr xs))
        (else (cons (car xs) (remove-one x (cdr xs))))))

;; ---- sample: softmax + categorical draw. the draw u is passed explicitly so
;;      the reference is a pure function; the native kernel takes u from the
;;      image PRNG. equivalence is tested with the same u.
(define (sample-ref logits u)
  (let ((ps (tensor->lists (softmax-ref logits))))
    (pick ps u 0)))
(define (pick ps u i)
  (cond ((null? (cdr ps)) i)
        ((< u (car ps)) i)
        (else (pick (cdr ps) (- u (car ps)) (+ i 1)))))
