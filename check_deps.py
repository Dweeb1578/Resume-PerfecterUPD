try:
    import pypdf
    print("pypdf OK")
except ImportError:
    print("pypdf MISSING")

try:
    import groq
    print("groq OK")
except ImportError:
    print("groq MISSING")

try:
    import dotenv
    print("dotenv OK")
except ImportError:
    print("dotenv MISSING")
